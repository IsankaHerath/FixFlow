import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "../src/lib/db";
async function main() {
  const input = z
    .object({
      BOOTSTRAP_EMAIL: z.email(),
      BOOTSTRAP_NAME: z.string().min(2),
      BOOTSTRAP_PASSWORD: z.string().min(16).max(128),
    })
    .parse(process.env);
  if (await db.user.count({ where: { role: "SUPER_ADMIN" } }))
    throw new Error(
      "An administrator already exists. Bootstrap is first-run only.",
    );
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name: input.BOOTSTRAP_NAME,
      email: input.BOOTSTRAP_EMAIL.toLowerCase(),
      role: "SUPER_ADMIN",
      emailVerified: true,
      accounts: {
        create: {
          id: randomUUID(),
          providerId: "credential",
          accountId: id,
          password: await hashPassword(input.BOOTSTRAP_PASSWORD),
        },
      },
    },
  });
  console.log(
    "Initial administrator created. Remove bootstrap credentials from your environment.",
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Bootstrap failed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
