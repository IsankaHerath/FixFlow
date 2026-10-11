import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { atomic, notify } from "@/server/services/shared";
import { reminderState } from "@/server/rules";
import { errorResponse } from "@/server/errors";
export async function POST(req: Request) {
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  if (
    !process.env.CRON_SECRET ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const dueIds = await db.$queryRaw<
      { id: string }[]
    >`SELECT r.id FROM "MaintenanceReminder" r JOIN "Vehicle" v ON v.id = r."vehicleId" WHERE NOT r.dismissed AND NOT r.notified AND ((r."dueMileage" IS NOT NULL AND r."dueMileage" - v.mileage <= 500) OR r."dueDate" <= NOW() + INTERVAL '30 days') ORDER BY r."createdAt" LIMIT 500`;
    const candidates = await db.maintenanceReminder.findMany({
      where: { id: { in: dueIds.map((r) => r.id) } },
      include: { vehicle: true },
    });
    let processed = 0;
    for (const reminder of candidates)
      if (
        reminderState(
          reminder.dueMileage,
          reminder.vehicle.mileage,
          reminder.dueDate,
        ) !== "SCHEDULED"
      ) {
        await atomic(async (tx) => {
          const claimed = await tx.maintenanceReminder.updateMany({
            where: { id: reminder.id, notified: false },
            data: { notified: true },
          });
          if (claimed.count) {
            await notify(
              tx,
              reminder.vehicle.ownerId,
              "Maintenance reminder",
              `${reminder.vehicle.registration}: ${reminder.title}`,
              "/dashboard/maintenance",
            );
            processed++;
          }
        });
      }
    return Response.json({ data: { processed } });
  } catch (error) {
    return errorResponse(error);
  }
}
