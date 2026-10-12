import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../../src/lib/db";
import { sendMail } from "../../src/server/mail";
import { dispatchNotificationEmail } from "../../src/server/services/notification-email";
import { dispatchReminder } from "../../src/server/services/reminders";
vi.mock("../../src/server/mail", () => ({ sendMail: vi.fn() }));

describe.skipIf(process.env.RUN_INTEGRATION !== "true")(
  "Notification processing",
  () => {
    const id = randomUUID();
    let vehicleId: string;
    beforeAll(async () => {
      if (process.env.NODE_ENV === "production")
        throw new Error("Use a test database.");
      await db.user.create({
        data: { id, name: "Notification test", email: `${id}@example.test` },
      });
      const vehicle = await db.vehicle.create({
        data: {
          ownerId: id,
          registration: id,
          make: "Test",
          model: "Test",
          year: 2020,
          category: "Car",
          fuel: "Petrol",
          transmission: "Manual",
          mileage: 1000,
        },
      });
      vehicleId = vehicle.id;
    });
    afterAll(async () => {
      await db.notification.deleteMany({ where: { userId: id } });
      await db.maintenanceReminder.deleteMany({ where: { vehicleId } });
      await db.vehicle.deleteMany({ where: { ownerId: id } });
      await db.user.deleteMany({ where: { id } });
      await db.$disconnect();
    });
    async function notification() {
      return db.notification.create({
        data: {
          userId: id,
          title: "Test",
          message: "Test",
          href: "/dashboard",
        },
      });
    }
    it("leases email once across simultaneous workers", async () => {
      vi.mocked(sendMail).mockReset().mockResolvedValue("ACCEPTED");
      const item = await notification();
      const outcomes = await Promise.all([
        dispatchNotificationEmail(item.id),
        dispatchNotificationEmail(item.id),
      ]);
      expect(outcomes.sort()).toEqual(["ACCEPTED", "SKIPPED"]);
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(
        (await db.notification.findUniqueOrThrow({ where: { id: item.id } }))
          .emailAttempts,
      ).toBe(1);
    });
    it("caps failed delivery retries and respects opt-out", async () => {
      vi.mocked(sendMail)
        .mockReset()
        .mockRejectedValue(new Error("Provider unavailable"));
      const item = await notification();
      for (let i = 0; i < 3; i++)
        expect(await dispatchNotificationEmail(item.id)).toBe("FAILED");
      expect(await dispatchNotificationEmail(item.id)).toBe("SKIPPED");
      expect(sendMail).toHaveBeenCalledTimes(3);
      await db.user.update({
        where: { id },
        data: { emailNotifications: false },
      });
      const optOut = await notification();
      expect(await dispatchNotificationEmail(optOut.id)).toBe("SKIPPED");
      expect(sendMail).toHaveBeenCalledTimes(3);
    });
    it("creates one due reminder and excludes future and dismissed reminders", async () => {
      const due = await db.maintenanceReminder.create({
        data: {
          vehicleId,
          title: "Oil",
          dueMileage: 1400,
          sourceKey: randomUUID(),
          explanation: "Test interval",
        },
      });
      const before = await db.notification.count({ where: { userId: id } });
      expect(await dispatchReminder(due.id)).toBe(true);
      expect(await dispatchReminder(due.id)).toBe(false);
      const future = await db.maintenanceReminder.create({
        data: {
          vehicleId,
          title: "Later",
          dueMileage: 9000,
          sourceKey: randomUUID(),
          explanation: "Test interval",
        },
      });
      expect(await dispatchReminder(future.id)).toBe(false);
      await db.maintenanceReminder.update({
        where: { id: future.id },
        data: { dueMileage: 1000, dismissed: true },
      });
      expect(await dispatchReminder(future.id)).toBe(false);
      expect(await db.notification.count({ where: { userId: id } })).toBe(
        before + 1,
      );
    });
  },
);
