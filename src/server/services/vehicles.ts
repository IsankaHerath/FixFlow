import { db } from "@/lib/db";
import { vehicleInput } from "../validation";
import { type Actor, customer } from "../policies";
import { check } from "../errors";
import { atomic, audit } from "./shared";
export async function saveVehicle(user: Actor, body: unknown, id?: string) {
  customer(user);
  const data = vehicleInput.parse(body);
  return atomic(async (tx) => {
    if (id) {
      const current = await tx.vehicle.findFirst({
        where: { id, ownerId: user.id, archived: false },
      });
      check(current, "Vehicle not found.", 404);
      check(
        data.mileage >= current.mileage,
        "Mileage cannot decrease. Contact your service center to request a documented correction.",
      );
      check(
        data.registration === current.registration,
        "Registration changes require an ownership review.",
      );
      const vehicle = await tx.vehicle.update({ where: { id }, data });
      if (data.mileage !== current.mileage)
        await tx.mileageRecord.create({
          data: { vehicleId: id, mileage: data.mileage, note: "Owner update" },
        });
      await audit(tx, user.id, "VEHICLE_UPDATED", id);
      return vehicle;
    }
    const vehicle = await tx.vehicle.create({
      data: {
        ...data,
        ownerId: user.id,
        mileageRecords: {
          create: { mileage: data.mileage, note: "Initial reading" },
        },
      },
    });
    await audit(tx, user.id, "VEHICLE_CREATED", vehicle.id);
    return vehicle;
  });
}
export async function archiveVehicle(user: Actor, id: string) {
  return atomic(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({
      where: { id, ownerId: user.id },
    });
    check(vehicle, "Vehicle not found.", 404);
    const active = await tx.appointment.count({
      where: {
        vehicleId: id,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      },
    });
    check(!active, "Cancel or complete active appointments before archiving.");
    await audit(tx, user.id, "VEHICLE_ARCHIVED", id);
    return tx.vehicle.update({ where: { id }, data: { archived: true } });
  });
}
export const getVehicles = (user: Actor) =>
  db.vehicle.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
