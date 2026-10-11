import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { book, updateAppointment } from "../src/server/services/appointments";
import {
  workAction,
  createEstimate,
  decideEstimate,
} from "../src/server/services/work-orders";
import {
  issueInvoice,
  recordPayment,
  stockMovement,
} from "../src/server/services/finance";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import type { Role } from "../generated/prisma/client";
async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEMO_SEED !== "true"
  )
    throw new Error(
      "Demo seeding requires a non-production environment and ALLOW_DEMO_SEED=true.",
    );
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Set a private DEMO_PASSWORD of at least 12 characters.");
  const hashed = await hashPassword(password);
  async function account(email: string, name: string, role: Role) {
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, emailVerified: true },
    });
    await db.account.upsert({
      where: {
        providerId_accountId: { providerId: "credential", accountId: user.id },
      },
      update: { password: hashed },
      create: {
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashed,
      },
    });
    return user;
  }
  const owner = await account("owner@fixflow.example", "Ari Demo", "CUSTOMER");
  const other = await account(
    "owner2@fixflow.example",
    "Nila Example",
    "CUSTOMER",
  );
  const manager = await account(
    "manager@fixflow.example",
    "Sam Workshop",
    "MANAGER",
  );
  const tech = await account(
    "technician@fixflow.example",
    "Kai Technician",
    "TECHNICIAN",
  );
  const outsider = await account(
    "technician2@fixflow.example",
    "Robin Technician",
    "TECHNICIAN",
  );
  await account(
    "admin@fixflow.example",
    "FixFlow Administrator",
    "SUPER_ADMIN",
  );
  const center = await db.serviceCenter.upsert({
    where: { id: "demo-center-colombo" },
    update: {},
    create: {
      id: "demo-center-colombo",
      name: "Harbor Auto Care · Demo",
      description:
        "A fictional workshop for exploring the complete FixFlow service journey.",
      address: "12 Example Avenue",
      district: "Colombo",
      phone: "000 000 0000",
      email: "harbor@fixflow.example",
      capacity: 3,
      openDays: [0, 1, 2, 3, 4, 5, 6],
    },
  });
  const second = await db.serviceCenter.upsert({
    where: { id: "demo-center-kandy" },
    update: {},
    create: {
      id: "demo-center-kandy",
      name: "Hillcrest Motors · Demo",
      description:
        "Fictional second center for tenant-isolation demonstrations.",
      address: "8 Sample Lane",
      district: "Kandy",
      province: "Central",
      phone: "000 000 0000",
      email: "hillcrest@fixflow.example",
    },
  });
  for (const [userId, centerId, role] of [
    [manager.id, center.id, "MANAGER"],
    [tech.id, center.id, "TECHNICIAN"],
    [outsider.id, second.id, "TECHNICIAN"],
  ] as const)
    await db.membership.upsert({
      where: { userId_centerId: { userId, centerId } },
      update: {},
      create: {
        userId,
        centerId,
        role,
        specializations:
          role === "TECHNICIAN" ? "General maintenance, brakes" : "",
      },
    });
  const service = await db.service.upsert({
    where: { id: "demo-general-service" },
    update: {},
    create: {
      id: "demo-general-service",
      centerId: center.id,
      name: "Complete vehicle service",
      category: "General Service",
      description: "Inspection, fluids and essential maintenance",
      duration: 60,
      startingPrice: 1250000,
      intervalKm: 5000,
      intervalMonths: 6,
    },
  });
  await db.service.upsert({
    where: { id: "demo-brake-inspection" },
    update: {},
    create: {
      id: "demo-brake-inspection",
      centerId: center.id,
      name: "Brake inspection",
      category: "Brakes",
      duration: 30,
      startingPrice: 350000,
      intervalKm: 10000,
      intervalMonths: 12,
    },
  });
  await db.service.upsert({
    where: { id: "demo-kandy-service" },
    update: {},
    create: {
      id: "demo-kandy-service",
      centerId: second.id,
      name: "General inspection",
      category: "Inspection",
      duration: 60,
      startingPrice: 500000,
    },
  });
  const v = await db.vehicle.upsert({
    where: { registration: "DEMO001" },
    update: {},
    create: {
      ownerId: owner.id,
      registration: "DEMO001",
      make: "Toyota",
      model: "Corolla",
      year: 2021,
      category: "Car",
      fuel: "Hybrid",
      transmission: "Automatic",
      mileage: 48500,
      color: "Pearl white",
      mileageRecords: {
        create: { mileage: 48500, note: "Demo initial reading" },
      },
    },
  });
  await db.vehicle.upsert({
    where: { registration: "DEMO002" },
    update: {},
    create: {
      ownerId: owner.id,
      registration: "DEMO002",
      make: "Honda",
      model: "Vezel",
      year: 2020,
      category: "SUV",
      fuel: "Hybrid",
      transmission: "Automatic",
      mileage: 32600,
    },
  });
  await db.vehicle.upsert({
    where: { registration: "OTHER001" },
    update: {},
    create: {
      ownerId: other.id,
      registration: "OTHER001",
      make: "Suzuki",
      model: "Swift",
      year: 2019,
      category: "Car",
      fuel: "Petrol",
      transmission: "Manual",
      mileage: 55000,
    },
  });
  const part = await db.inventoryPart.upsert({
    where: { centerId_sku: { centerId: center.id, sku: "OIL-5W30-DEMO" } },
    update: {},
    create: {
      centerId: center.id,
      sku: "OIL-5W30-DEMO",
      name: "Engine oil 5W-30 (1L)",
      cost: 220000,
      price: 280000,
      reorderLevel: 8,
    },
  });
  const actorFor = async (id: string) => {
    const u = await db.user.findUniqueOrThrow({
      where: { id },
      include: { memberships: { where: { active: true } } },
    });
    return u;
  };
  const managerActor = await actorFor(manager.id),
    ownerActor = await actorFor(owner.id),
    techActor = await actorFor(tech.id);
  if ((await db.appointment.count({ where: { customerId: owner.id } })) === 0) {
    await stockMovement(managerActor, part.id, {
      delta: 24,
      reason: "Opening demo inventory",
      requestKey: randomUUID(),
    });
    const dateString = formatInTimeZone(
      addDays(new Date(), 2),
      "Asia/Colombo",
      "yyyy-MM-dd",
    );
    for (const [index, hour] of [9, 11, 14].entries()) {
      const appt = await book(ownerActor, {
        vehicleId: v.id,
        centerId: center.id,
        serviceId: service.id,
        startsAt: fromZonedTime(
          `${dateString}T${String(hour).padStart(2, "0")}:00:00`,
          "Asia/Colombo",
        ).toISOString(),
        description: "Development demonstration service appointment",
        requestKey: randomUUID(),
      });
      if (index === 2) continue;
      await updateAppointment(managerActor, appt.id, { status: "CONFIRMED" });
      await updateAppointment(managerActor, appt.id, { status: "CHECKED_IN" });
      const work = await db.workOrder.findUniqueOrThrow({
        where: { appointmentId: appt.id },
      });
      await workAction(managerActor, work.id, "assign", {
        technicianId: tech.id,
      });
      await workAction(techActor, work.id, "status", {
        status: "INSPECTION",
        note: "Initial vehicle inspection started.",
      });
      await workAction(techActor, work.id, "inspection", {
        mileage: 48500,
        findings:
          "Routine service due. Replace engine oil and inspect brake components.",
        severity: "LOW",
        checklist: { Engine: "PASS", Brakes: "PASS", Fluids: "ATTENTION" },
      });
      await workAction(techActor, work.id, "task", {
        title: "Replace engine oil and complete safety inspection",
      });
      const estimate = await createEstimate(managerActor, work.id, {
        items: [
          {
            description: "Engine oil 5W-30",
            kind: "PART",
            quantity: 4,
            unitPrice: 280000,
          },
          {
            description: "Service labor",
            kind: "LABOR",
            quantity: 1,
            unitPrice: 450000,
          },
        ],
        expiresAt: addDays(new Date(), 7).toISOString(),
        taxBps: 0,
      });
      if (index === 1) continue;
      await decideEstimate(ownerActor, estimate.id, { approved: true });
      await workAction(techActor, work.id, "status", {
        status: "IN_PROGRESS",
        note: "Approved maintenance work started.",
      });
      const task = await db.workOrderTask.findFirstOrThrow({
        where: { workOrderId: work.id },
      });
      await workAction(techActor, work.id, "task", {
        taskId: task.id,
        title: task.title,
        done: true,
      });
      await workAction(techActor, work.id, "labor", {
        description: "Oil replacement and safety inspection",
        minutes: 60,
      });
      await stockMovement(managerActor, part.id, {
        delta: -4,
        reason: "Oil service consumption",
        workOrderId: work.id,
        requestKey: randomUUID(),
      });
      await workAction(techActor, work.id, "status", {
        status: "QUALITY_CHECK",
        note: "All scheduled tasks completed.",
      });
      await workAction(managerActor, work.id, "status", {
        status: "READY_FOR_COLLECTION",
        note: "Final quality check passed. Your vehicle is ready.",
      });
      const invoice = await issueInvoice(managerActor, work.id);
      await recordPayment(managerActor, invoice.id, {
        amount: invoice.total,
        method: "CASH",
        reference: "DEMO-RECEIPT",
        requestKey: randomUUID(),
      });
      await workAction(managerActor, work.id, "status", {
        status: "DELIVERED",
        note: "Vehicle collected by the owner.",
      });
      await workAction(managerActor, work.id, "status", {
        status: "CLOSED",
        note: "Service complete and invoice settled.",
      });
    }
  }
  console.log(
    "Demo records ready. Accounts use the private DEMO_PASSWORD from your environment. See README for account emails.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
