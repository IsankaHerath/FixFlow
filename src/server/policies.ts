import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { check } from "./errors";
import type { Prisma } from "../../generated/prisma/client";
export async function actor(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  check(session, "Please sign in to continue.", 401);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: { where: { active: true, center: { active: true } } },
    },
  });
  check(user?.active, "Your account is unavailable.", 403);
  return user;
}
export type Actor = Awaited<ReturnType<typeof actor>>;
export function centers(user: Actor, role?: "MANAGER" | "TECHNICIAN") {
  return user.memberships
    .filter((m) => !role || m.role === role)
    .map((m) => m.centerId);
}
export function manager(user: Actor, centerId: string) {
  check(
    centers(user, "MANAGER").includes(centerId),
    "Center manager access required.",
    403,
  );
}
export function admin(user: Actor) {
  check(
    user.role === "SUPER_ADMIN",
    "System administrator access required.",
    403,
  );
}
export function customer(user: Actor) {
  check(user.role === "CUSTOMER", "Customer access required.", 403);
}
export function workScope(user: Actor): Prisma.WorkOrderWhereInput {
  return {
    OR: [
      { appointment: { customerId: user.id } },
      { centerId: { in: centers(user, "MANAGER") } },
      { centerId: { in: centers(user, "TECHNICIAN") }, technicianId: user.id },
    ],
  };
}
export function appointmentScope(user: Actor): Prisma.AppointmentWhereInput {
  return {
    OR: [
      { customerId: user.id },
      { centerId: { in: centers(user, "MANAGER") } },
    ],
  };
}
export function vehicleScope(user: Actor): Prisma.VehicleWhereInput {
  return {
    OR: [
      { ownerId: user.id },
      {
        appointments: { some: { centerId: { in: centers(user, "MANAGER") } } },
      },
    ],
  };
}
