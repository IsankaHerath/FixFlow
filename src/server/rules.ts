import { formatInTimeZone } from "date-fns-tz";
import { check } from "./errors";
export const transitions: Record<string, string[]> = {
  RECEIVED: ["INSPECTION", "CANCELLED"],
  INSPECTION: ["AWAITING_ESTIMATE_APPROVAL", "CANCELLED"],
  AWAITING_ESTIMATE_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["QUALITY_CHECK"],
  QUALITY_CHECK: ["IN_PROGRESS", "READY_FOR_COLLECTION"],
  READY_FOR_COLLECTION: ["DELIVERED"],
  DELIVERED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};
export function validateTransition(from: string, to: string) {
  check(
    transitions[from]?.includes(to),
    `Cannot move from ${from} to ${to}.`,
    409,
  );
}
export function peakOverlap(
  bookings: { startsAt: Date; endsAt: Date }[],
  startsAt: Date,
  endsAt: Date,
) {
  const events = bookings
    .filter((b) => b.startsAt < endsAt && b.endsAt > startsAt)
    .flatMap((b) => [
      { time: Math.max(b.startsAt.getTime(), startsAt.getTime()), delta: 1 },
      { time: Math.min(b.endsAt.getTime(), endsAt.getTime()), delta: -1 },
    ])
    .sort((a, b) => a.time - b.time || a.delta - b.delta);
  let concurrent = 0,
    peak = 0;
  for (const event of events) {
    concurrent += event.delta;
    peak = Math.max(peak, concurrent);
  }
  return peak;
}
export function totals(
  items: { quantity: number; unitPrice: number }[],
  discount = 0,
  taxBps = 0,
) {
  check(items.length > 0 && items.length <= 100, "Provide 1–100 line items.");
  for (const i of items)
    check(
      Number.isSafeInteger(i.quantity) &&
        i.quantity > 0 &&
        Number.isSafeInteger(i.unitPrice) &&
        i.unitPrice >= 0,
      "Invalid line item.",
    );
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  check(
    Number.isSafeInteger(subtotal) && subtotal <= 2_000_000_000,
    "Amount exceeds the supported limit.",
  );
  check(
    Number.isInteger(discount) && discount >= 0 && discount <= subtotal,
    "Discount exceeds subtotal.",
  );
  check(
    Number.isInteger(taxBps) && taxBps >= 0 && taxBps <= 10000,
    "Invalid tax rate.",
  );
  const taxable = subtotal - discount;
  const tax = Number((BigInt(taxable) * BigInt(taxBps) + 5000n) / 10000n);
  check(taxable + tax <= 2_000_000_000, "Total exceeds the supported limit.");
  return { subtotal, tax, total: taxable + tax };
}
export function validateSlot(
  center: {
    timezone: string;
    openHour: number;
    closeHour: number;
    openDays: number[];
    closures: string[];
  },
  start: Date,
  duration: number,
  now = new Date(),
) {
  check(start > now, "Choose a future appointment.");
  check(
    start.getTime() < now.getTime() + 90 * 86400000,
    "Book within the next 90 days.",
  );
  const day = formatInTimeZone(start, center.timezone, "yyyy-MM-dd");
  const weekday = Number(formatInTimeZone(start, center.timezone, "i")) % 7;
  const hour = Number(formatInTimeZone(start, center.timezone, "H"));
  const minute = Number(formatInTimeZone(start, center.timezone, "m"));
  check(
    center.openDays.includes(weekday) && !center.closures.includes(day),
    "The center is closed on this date.",
  );
  check(
    start.getUTCSeconds() === 0 &&
      start.getUTCMilliseconds() === 0 &&
      minute % 30 === 0,
    "Choose a valid half-hour slot.",
  );
  check(
    hour * 60 + minute >= center.openHour * 60 &&
      hour * 60 + minute + duration <= center.closeHour * 60,
    "The service must fit within opening hours.",
  );
  return new Date(start.getTime() + duration * 60000);
}
export function reminderState(
  dueMileage: number | null,
  mileage: number,
  dueDate: Date | null,
  now = new Date(),
) {
  if (
    (dueMileage !== null && mileage > dueMileage) ||
    (dueDate && dueDate < now)
  )
    return "OVERDUE";
  if (dueMileage !== null && mileage === dueMileage) return "DUE";
  if (
    (dueMileage !== null && dueMileage - mileage <= 500) ||
    (dueDate && dueDate.getTime() - now.getTime() <= 30 * 86400000)
  )
    return "UPCOMING";
  return "SCHEDULED";
}
