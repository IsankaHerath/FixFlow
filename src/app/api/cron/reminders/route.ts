import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { dispatchReminder } from "@/server/services/reminders";
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
    let processed = 0;
    for (const reminder of dueIds)
      if (await dispatchReminder(reminder.id)) processed++;
    return Response.json({ data: { processed } });
  } catch (error) {
    return errorResponse(error);
  }
}
