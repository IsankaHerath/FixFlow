import { describe, it, expect } from "vitest";
import {
  totals,
  validateTransition,
  validateSlot,
  reminderState,
} from "../../src/server/rules";
describe("money calculations", () => {
  it("rounds half-up using exact integer arithmetic", () => {
    expect(totals([{ quantity: 3, unitPrice: 199 }], 97, 1500)).toEqual({
      subtotal: 597,
      tax: 75,
      total: 575,
    });
    expect(totals([{ quantity: 1, unitPrice: 1 }], 0, 5000).tax).toBe(1);
  });
  it("rejects negative values, fractional quantities and excessive discounts", () => {
    expect(() => totals([{ quantity: 1, unitPrice: -1 }])).toThrow();
    expect(() => totals([{ quantity: 1.1, unitPrice: 100 }])).toThrow();
    expect(() => totals([{ quantity: 1, unitPrice: 100 }], 101)).toThrow();
  });
  it("rejects database integer overflow", () => {
    expect(() => totals([{ quantity: 100000, unitPrice: 100000 }])).toThrow();
  });
});
describe("repair lifecycle", () => {
  it("requires approval before repairs", () =>
    expect(() => validateTransition("INSPECTION", "IN_PROGRESS")).toThrow());
  it("permits quality rework but never reopens closed jobs", () => {
    expect(() =>
      validateTransition("QUALITY_CHECK", "IN_PROGRESS"),
    ).not.toThrow();
    expect(() => validateTransition("CLOSED", "INSPECTION")).toThrow();
  });
});
describe("appointment slots", () => {
  const center = {
    timezone: "Asia/Colombo",
    openHour: 8,
    closeHour: 17,
    openDays: [1, 2, 3, 4, 5, 6],
    closures: [],
  };
  const now = new Date("2026-10-01T00:00:00Z");
  it("handles the Colombo UTC offset", () =>
    expect(
      validateSlot(
        center,
        new Date("2026-10-02T03:30:00Z"),
        60,
        now,
      ).toISOString(),
    ).toBe("2026-10-02T04:30:00.000Z"));
  it("rejects closed dates and services extending beyond closing", () => {
    expect(() =>
      validateSlot(center, new Date("2026-10-04T03:30:00Z"), 60, now),
    ).toThrow();
    expect(() =>
      validateSlot(center, new Date("2026-10-02T11:00:00Z"), 60, now),
    ).toThrow();
    expect(() =>
      validateSlot(
        { ...center, closures: ["2026-10-02"] },
        new Date("2026-10-02T03:30:00Z"),
        60,
        now,
      ),
    ).toThrow();
  });
  it("rejects non-slot minute values", () =>
    expect(() =>
      validateSlot(center, new Date("2026-10-02T03:31:00Z"), 60, now),
    ).toThrow());
});
describe("maintenance reminders", () => {
  it("uses mileage and time independently", () => {
    const now = new Date("2026-10-01");
    expect(reminderState(55000, 54500, null, now)).toBe("UPCOMING");
    expect(reminderState(55000, 55000, null, now)).toBe("DUE");
    expect(reminderState(55000, 55001, null, now)).toBe("OVERDUE");
    expect(reminderState(null, 0, new Date("2026-09-01"), now)).toBe("OVERDUE");
    expect(reminderState(60000, 54000, new Date("2027-01-01"), now)).toBe(
      "SCHEDULED",
    );
  });
});
