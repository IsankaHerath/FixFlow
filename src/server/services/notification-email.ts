import { db } from "@/lib/db";
import { sendMail } from "../mail";
// A lease prevents two workers from dispatching the same notification concurrently.
// SMTP cannot provide exactly-once delivery across a crash after provider acceptance.
export async function dispatchNotificationEmails() {
  const stale = new Date(Date.now() - 10 * 60000);
  const pending = await db.notification.findMany({
    where: {
      emailAttempts: { lt: 3 },
      OR: [
        { emailStatus: "PENDING" },
        { emailStatus: "FAILED" },
        { emailStatus: "SENDING", emailClaimedAt: { lt: stale } },
      ],
    },
    select: { id: true },
    take: 50,
    orderBy: { createdAt: "asc" },
  });
  let accepted = 0,
    local = 0,
    failed = 0;
  for (const item of pending) {
    const status = await dispatchNotificationEmail(item.id);
    if (status === "ACCEPTED") accepted++;
    else if (status === "LOCAL") local++;
    else if (status === "FAILED") failed++;
  }
  return { accepted, local, failed };
}
export async function dispatchNotificationEmail(id: string) {
  const item = await db.notification.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, emailNotifications: true, active: true } },
    },
  });
  if (
    !item ||
    item.emailAttempts >= 3 ||
    !(
      ["PENDING", "FAILED"].includes(item.emailStatus) ||
      (item.emailStatus === "SENDING" &&
        item.emailClaimedAt &&
        item.emailClaimedAt < new Date(Date.now() - 10 * 60000))
    )
  )
    return "SKIPPED";
  const claim = await db.notification.updateMany({
    where: {
      id: item.id,
      emailStatus: item.emailStatus,
      emailAttempts: item.emailAttempts,
    },
    data: {
      emailStatus: "SENDING",
      emailClaimedAt: new Date(),
      emailAttempts: { increment: 1 },
    },
  });
  if (!claim.count) return "SKIPPED";
  if (!item.user.active || !item.user.emailNotifications) {
    await db.notification.update({
      where: { id: item.id },
      data: { emailStatus: "SKIPPED" },
    });
    return "SKIPPED";
  }
  try {
    const status = await sendMail(
      item.user.email,
      item.title,
      `${item.message}\n\nView details: ${process.env.BETTER_AUTH_URL}${item.href}`,
    );
    await db.notification.update({
      where: { id: item.id },
      data: { emailStatus: status },
    });
    return status;
  } catch {
    await db.notification.update({
      where: { id: item.id },
      data: { emailStatus: "FAILED" },
    });
    return "FAILED";
  }
}
