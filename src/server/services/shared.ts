import { db } from "@/lib/db";
import { Prisma } from "../../../generated/prisma/client";
export type Tx = Prisma.TransactionClient;
// Serializable transactions reject racing writes rather than allowing invalid business state.
export const atomic = <T>(fn: (tx: Tx) => Promise<T>) =>
  db.$transaction(fn, { isolationLevel: "Serializable", timeout: 15000 });
export const notify = (
  tx: Tx,
  userId: string,
  title: string,
  message: string,
  href = "/dashboard/repairs",
) => tx.notification.create({ data: { userId, title, message, href } });
export const audit = (
  tx: Tx,
  actorId: string,
  action: string,
  resourceId: string,
  centerId?: string,
) => tx.activityLog.create({ data: { actorId, action, resourceId, centerId } });
export async function centerNotify(
  tx: Tx,
  centerId: string,
  title: string,
  message: string,
) {
  const members = await tx.membership.findMany({
    where: { centerId, active: true, role: "MANAGER", user: { active: true } },
  });
  await tx.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      title,
      message,
      href: "/manager/appointments",
    })),
  });
}
