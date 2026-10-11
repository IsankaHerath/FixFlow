import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { type Actor, admin, manager } from "../policies";
import { check } from "../errors";
import { atomic, audit } from "./shared";
export async function createStaff(user: Actor, body: unknown) {
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.email().transform((v) => v.toLowerCase()),
      phone: z.string().max(30).default(""),
      password: z.string().min(12).max(128),
      centerId: z.string(),
      role: z.enum(["TECHNICIAN", "MANAGER"]),
      specializations: z.string().max(500).default(""),
    })
    .parse(body);
  if (input.role === "MANAGER") admin(user);
  else manager(user, input.centerId);
  const password = await hashPassword(input.password);
  return atomic(async (tx) => {
    check(
      await tx.serviceCenter.findUnique({ where: { id: input.centerId } }),
      "Center not found.",
      404,
    );
    const staff = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: input.email,
            providerId: "credential",
            password,
          },
        },
        memberships: {
          create: {
            centerId: input.centerId,
            role: input.role,
            specializations: input.specializations,
          },
        },
      },
      select: { id: true, name: true, email: true, role: true },
    });
    // Better Auth uses the user ID for credential accountId.
    await tx.account.updateMany({
      where: { userId: staff.id },
      data: { accountId: staff.id },
    });
    await audit(tx, user.id, "STAFF_CREATED", staff.id, input.centerId);
    return staff;
  });
}
