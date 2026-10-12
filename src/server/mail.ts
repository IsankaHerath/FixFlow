import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
export async function sendMail(to: string, subject: string, text: string) {
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_PORT === "465",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    const receipt = await transport.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
    });
    if (!receipt.accepted?.length)
      throw new Error("SMTP did not accept the message");
    return "ACCEPTED" as const;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "SMTP must be configured for password recovery in production",
    );
  await mkdir(".local/mail", { recursive: true });
  await writeFile(
    `.local/mail/${randomUUID()}.json`,
    JSON.stringify({ to, subject, text }, null, 2),
    { mode: 0o600 },
  );
  return "LOCAL" as const;
}
