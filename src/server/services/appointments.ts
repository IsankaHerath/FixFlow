import { db } from "@/lib/db";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { bookingInput } from "../validation";
import { type Actor, customer, manager, appointmentScope } from "../policies";
import { check } from "../errors";
import { validateSlot, peakOverlap } from "../rules";
import { atomic, audit, notify, centerNotify } from "./shared";
const reserved = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;
export async function availability(
  centerId: string,
  serviceId: string,
  day: string,
) {
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .parse(day);
  const center = await db.serviceCenter.findFirst({
    where: { id: centerId, active: true },
  });
  const service = await db.service.findFirst({
    where: { id: serviceId, centerId, active: true },
  });
  check(center && service, "Service center or service not found.", 404);
  const bookings = await db.appointment.findMany({
    where: {
      centerId,
      status: { in: [...reserved] },
      startsAt: {
        gte: fromZonedTime(`${day}T00:00:00`, center.timezone),
        lt: fromZonedTime(`${day}T23:59:59`, center.timezone),
      },
    },
    select: { startsAt: true, endsAt: true },
  });
  const slots = [];
  for (
    let min = center.openHour * 60;
    min + service.duration <= center.closeHour * 60;
    min += 30
  ) {
    const local = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    const start = fromZonedTime(`${day}T${local}:00`, center.timezone);
    try {
      const end = validateSlot(center, start, service.duration);
      if (peakOverlap(bookings, start, end) < center.capacity)
        slots.push({ startsAt: start.toISOString(), label: local });
    } catch {
      /* Invalid/closed slots are intentionally excluded. */
    }
  }
  return slots;
}
export async function book(user: Actor, body: unknown, rescheduleId?: string) {
  if (!rescheduleId) customer(user);
  const input = bookingInput.parse(body);
  return atomic(async (tx) => {
    const previous = rescheduleId ? await tx.appointment.findFirst({ where: { id: rescheduleId, ...appointmentScope(user) } }) : null;
    if (rescheduleId) {
      check(previous && ["PENDING", "CONFIRMED"].includes(previous.status) && previous.startsAt > new Date(), "This appointment cannot be rescheduled.", 409);
      if (previous.customerId !== user.id) {
        manager(user, previous.centerId);
        check(input.centerId === previous.centerId && input.vehicleId === previous.vehicleId, "Workshop rescheduling must retain the vehicle and center.");
      }
    }
    const customerId = previous?.customerId ?? user.id;
    const existing = await tx.appointment.findUnique({
      where: { requestKey: input.requestKey },
    });
    if (existing && !rescheduleId) {
      check(existing.customerId === user.id, "Duplicate booking request.", 409);
      return existing;
    }
    const vehicle = await tx.vehicle.findFirst({
      where: { id: input.vehicleId, ownerId: customerId, archived: false },
    });
    const center = await tx.serviceCenter.findFirst({
      where: { id: input.centerId, active: true },
    });
    const service = await tx.service.findFirst({
      where: { id: input.serviceId, centerId: input.centerId, active: true },
    });
    check(
      vehicle && center && service,
      "Choose a valid vehicle, center and service.",
    );
    const startsAt = new Date(input.startsAt);
    const endsAt = validateSlot(center, startsAt, service.duration);
    const overlap = {
      status: { in: [...reserved] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(rescheduleId ? { id: { not: rescheduleId } } : {}),
    };
    const overlapping = await tx.appointment.findMany({
      where: { ...overlap, centerId: center.id },
      select: { startsAt: true, endsAt: true },
    });
    check(
      peakOverlap(overlapping, startsAt, endsAt) < center.capacity,
      "This slot has just filled up. Choose another time.",
      409,
    );
    check(
      (await tx.appointment.count({
        where: { ...overlap, vehicleId: vehicle.id },
      })) === 0,
      "This vehicle already has an overlapping booking.",
      409,
    );
    let result;
    if (rescheduleId) {
      result = await tx.appointment.update({
        where: { id: rescheduleId },
        data: { ...input, startsAt, endsAt, status: "PENDING" },
      });
    } else
      result = await tx.appointment.create({
        data: { ...input, customerId: user.id, startsAt, endsAt },
      });
    await notify(
      tx,
      customerId,
      rescheduleId ? "Appointment rescheduled" : "Booking requested",
      `${service.name} at ${center.name}. Your request is awaiting confirmation.`,
      "/dashboard/appointments",
    );
    await centerNotify(
      tx,
      center.id,
      "Appointment request",
      `${vehicle.registration}: ${service.name}`,
    );
    await audit(
      tx,
      user.id,
      rescheduleId ? "APPOINTMENT_RESCHEDULED" : "APPOINTMENT_CREATED",
      result.id,
      center.id,
    );
    return result;
  });
}
export async function updateAppointment(
  user: Actor,
  id: string,
  body: unknown,
) {
  const input = z
    .object({
      status: z.enum([
        "CONFIRMED",
        "REJECTED",
        "CANCELLED",
        "CHECKED_IN",
        "NO_SHOW",
      ]),
      managerNotes: z.string().max(2000).optional(),
    })
    .parse(body);
  return atomic(async (tx) => {
    const appt = await tx.appointment.findFirst({
      where: { id, ...appointmentScope(user) },
    });
    check(appt, "Appointment not found.", 404);
    if (input.status === "CANCELLED" && appt.customerId === user.id)
      check(
        ["PENDING", "CONFIRMED"].includes(appt.status) &&
          appt.startsAt > new Date(),
        "Cancellation is no longer available.",
        409,
      );
    else {
      manager(user, appt.centerId);
      const allowed: Record<string, string[]> = {
        PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
        CONFIRMED: ["CHECKED_IN", "NO_SHOW", "CANCELLED"],
      };
      check(
        allowed[appt.status]?.includes(input.status),
        "Invalid appointment transition.",
        409,
      );
      if (input.status === "NO_SHOW")
        check(appt.startsAt < new Date(), "Appointment has not started.");
    }
    if (input.status === "CHECKED_IN")
      await tx.workOrder.create({
        data: {
          appointmentId: id,
          centerId: appt.centerId,
          history: {
            create: { status: "RECEIVED", note: "Vehicle checked in" },
          },
        },
      });
    const result = await tx.appointment.update({
      where: { id },
      data: {
        status: input.status,
        ...(appt.customerId !== user.id
          ? { managerNotes: input.managerNotes }
          : {}),
      },
    });
    await notify(
      tx,
      appt.customerId,
      "Appointment updated",
      `Your booking is now ${input.status.toLowerCase().replaceAll("_", " ")}.`,
      "/dashboard/appointments",
    );
    await audit(tx, user.id, `APPOINTMENT_${input.status}`, id, appt.centerId);
    return result;
  });
}
