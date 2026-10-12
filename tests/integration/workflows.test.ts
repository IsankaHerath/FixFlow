import "dotenv/config";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { db } from "../../src/lib/db";
import { saveVehicle } from "../../src/server/services/vehicles";
import {
  book,
  updateAppointment,
} from "../../src/server/services/appointments";
import {
  workAction,
  createEstimate,
  decideEstimate,
} from "../../src/server/services/work-orders";
import {
  issueInvoice,
  recordPayment,
  stockMovement,
  invoicePdf,
} from "../../src/server/services/finance";
import { workDetail, vehicleDetail } from "../../src/server/services/queries";
import type { Actor } from "../../src/server/policies";
const enabled = process.env.RUN_INTEGRATION === "true";
describe.skipIf(!enabled)("PostgreSQL workflow and tenant isolation", () => {
  let customer: Actor,
    other: Actor,
    manager: Actor,
    tech: Actor,
    outsider: Actor;
  let centerId: string,
    serviceId: string,
    vehicleId: string,
    workId: string,
    partId: string;
  const userIds: string[] = [];
  const centerIds: string[] = [];
  const suffix = randomUUID().slice(0, 8);
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Never run integration tests against production.");
    const center = await db.serviceCenter.create({
      data: {
        name: `Test center ${suffix}`,
        address: "Test",
        district: "Test",
        phone: "000",
        email: `center-${suffix}@example.test`,
        capacity: 1,
        openDays: [0, 1, 2, 3, 4, 5, 6],
      },
    });
    centerId = center.id;
    centerIds.push(center.id);
    const second = await db.serviceCenter.create({
      data: {
        name: `Other center ${suffix}`,
        address: "Test",
        district: "Test",
        phone: "000",
        email: `other-${suffix}@example.test`,
      },
    });
    centerIds.push(second.id);
    async function user(
      role: "CUSTOMER" | "MANAGER" | "TECHNICIAN",
      n: string,
      center?: string,
    ) {
      const u = await db.user.create({
        data: {
          name: n,
          email: `${n}-${suffix}@example.test`,
          role,
          ...(center
            ? { memberships: { create: { centerId: center, role } } }
            : {}),
        },
        include: { memberships: true },
      });
      userIds.push(u.id);
      return u;
    }
    customer = await user("CUSTOMER", "owner");
    other = await user("CUSTOMER", "other");
    manager = await user("MANAGER", "manager", centerId);
    tech = await user("TECHNICIAN", "tech", centerId);
    outsider = await user("TECHNICIAN", "outsider", second.id);
    const service = await db.service.create({
      data: {
        centerId,
        name: "Oil service",
        category: "General",
        duration: 60,
        startingPrice: 10000,
        intervalKm: 5000,
        intervalMonths: 6,
      },
    });
    serviceId = service.id;
    const vehicle = await saveVehicle(customer, {
      registration: `TEST-${suffix}`,
      make: "Test",
      model: "Car",
      year: 2020,
      category: "Car",
      fuel: "Petrol",
      transmission: "Manual",
      mileage: 50000,
    });
    vehicleId = vehicle.id;
    const part = await db.inventoryPart.create({
      data: { centerId, sku: suffix, name: "Oil", cost: 1000, price: 2000 },
    });
    partId = part.id;
  });
  afterAll(async () => {
    // Delete only records created by this suite, in foreign-key order.
    const appointments = await db.appointment.findMany({
      where: { centerId: { in: centerIds } },
      select: { id: true },
    });
    const works = await db.workOrder.findMany({
      where: { centerId: { in: centerIds } },
      select: { id: true },
    });
    const wids = works.map((w) => w.id);
    const vehicles = await db.vehicle.findMany({
      where: { ownerId: { in: userIds } },
      select: { id: true },
    });
    const vids = vehicles.map((v) => v.id);
    await db.$transaction(async (tx) => {
      await tx.payment.deleteMany({
        where: { invoice: { workOrderId: { in: wids } } },
      });
      await tx.invoice.deleteMany({ where: { workOrderId: { in: wids } } });
      await tx.estimateApproval.deleteMany({
        where: { estimate: { workOrderId: { in: wids } } },
      });
      await tx.estimateItem.deleteMany({
        where: { estimate: { workOrderId: { in: wids } } },
      });
      await tx.estimate.deleteMany({ where: { workOrderId: { in: wids } } });
      await tx.inspection.deleteMany({ where: { workOrderId: { in: wids } } });
      await tx.workOrderTask.deleteMany({
        where: { workOrderId: { in: wids } },
      });
      await tx.workOrderStatusHistory.deleteMany({
        where: { workOrderId: { in: wids } },
      });
      await tx.partUsage.deleteMany({ where: { workOrderId: { in: wids } } });
      await tx.laborEntry.deleteMany({ where: { workOrderId: { in: wids } } });
      await tx.maintenanceRecord.deleteMany({
        where: { workOrderId: { in: wids } },
      });
      await tx.maintenanceReminder.deleteMany({
        where: { vehicleId: { in: vids } },
      });
      await tx.workOrder.deleteMany({ where: { id: { in: wids } } });
      await tx.appointment.deleteMany({
        where: { id: { in: appointments.map((a) => a.id) } },
      });
      await tx.inventoryMovement.deleteMany({
        where: { part: { centerId: { in: centerIds } } },
      });
      await tx.inventoryPart.deleteMany({
        where: { centerId: { in: centerIds } },
      });
      await tx.service.deleteMany({ where: { centerId: { in: centerIds } } });
      await tx.activityLog.deleteMany({ where: { actorId: { in: userIds } } });
      await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
      await tx.mileageRecord.deleteMany({ where: { vehicleId: { in: vids } } });
      await tx.vehicle.deleteMany({ where: { id: { in: vids } } });
      await tx.membership.deleteMany({ where: { userId: { in: userIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      await tx.serviceCenter.deleteMany({ where: { id: { in: centerIds } } });
    });
    await db.$disconnect();
  });
  it("persists vehicles and rejects another customer's edits", async () => {
    const v = await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    expect(v.registration).toBe(`TEST${suffix}`.toUpperCase());
    expect(await vehicleDetail(other, vehicleId)).toBeNull();
    expect(
      (await vehicleDetail(customer, vehicleId))?.mileageRecords,
    ).toHaveLength(1);
    await expect(
      saveVehicle(other, { ...v, mileage: 51000 }, vehicleId),
    ).rejects.toThrow("Vehicle not found");
    await expect(
      saveVehicle(customer, { ...v, mileage: 49000 }, vehicleId),
    ).rejects.toThrow("Mileage cannot decrease");
  });
  it("serializes competing bookings and prevents over-capacity", async () => {
    const day = formatInTimeZone(
      new Date(Date.now() + 7 * 86400000),
      "Asia/Colombo",
      "yyyy-MM-dd",
    );
    const startsAt = fromZonedTime(
      `${day}T09:00:00`,
      "Asia/Colombo",
    ).toISOString();
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        book(customer, {
          vehicleId,
          centerId,
          serviceId,
          startsAt,
          description: "Concurrent booking test",
          requestKey: randomUUID(),
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.appointment.count({ where: { centerId } })).toBe(1);
    const appt = await db.appointment.findFirstOrThrow({ where: { centerId } });
    await updateAppointment(manager, appt.id, { status: "CONFIRMED" });
    await updateAppointment(manager, appt.id, { status: "CHECKED_IN" });
    workId = (
      await db.workOrder.findUniqueOrThrow({
        where: { appointmentId: appt.id },
      })
    ).id;
  });
  it("isolates jobs and validates assignment membership", async () => {
    expect(await workDetail(other, workId)).toBeNull();
    expect(await workDetail(outsider, workId)).toBeNull();
    await expect(
      workAction(manager, workId, "assign", { technicianId: outsider.id }),
    ).rejects.toThrow("active technician");
    await workAction(manager, workId, "assign", { technicianId: tech.id });
    await workAction(tech, workId, "status", {
      status: "INSPECTION",
      note: "Inspection started",
    });
    await expect(
      workAction(tech, workId, "status", {
        status: "IN_PROGRESS",
        note: "Attempt unauthorized repair",
      }),
    ).rejects.toThrow();
  });
  it("preserves approval versions and prevents repairs before renewed consent", async () => {
    await workAction(tech, workId, "inspection", {
      mileage: 50000,
      findings: "Oil replacement required",
      severity: "LOW",
      checklist: { Fluids: "ATTENTION" },
    });
    const input = {
      items: [
        { description: "Oil", kind: "PART", quantity: 4, unitPrice: 2000 },
        { description: "Labor", kind: "LABOR", quantity: 1, unitPrice: 4000 },
      ],
      discount: 1000,
      taxBps: 0,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const first = await createEstimate(manager, workId, input);
    await expect(
      decideEstimate(other, first.id, { approved: true }),
    ).rejects.toThrow("not found");
    await expect(
      decideEstimate(tech, first.id, { approved: true }),
    ).rejects.toThrow("not found");
    await db.estimate.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      decideEstimate(customer, first.id, { approved: true }),
    ).rejects.toThrow();
    await db.estimate.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() + 86400000) },
    });
    await decideEstimate(customer, first.id, { approved: true });
    const second = await createEstimate(manager, workId, {
      ...input,
      discount: 0,
    });
    expect((await workDetail(tech, workId))?.estimates).toEqual([]);
    expect(await workDetail({ ...tech, memberships: [] }, workId)).toBeNull();
    expect(
      (await db.estimate.findUniqueOrThrow({ where: { id: first.id } })).status,
    ).toBe("APPROVED");
    await expect(
      workAction(tech, workId, "status", {
        status: "IN_PROGRESS",
        note: "Work should remain blocked",
      }),
    ).rejects.toThrow();
    await decideEstimate(customer, second.id, { approved: true });
    await workAction(tech, workId, "status", {
      status: "IN_PROGRESS",
      note: "Approved repairs started",
    });
  });
  it("records inventory once and never allows negative stock", async () => {
    const key = randomUUID();
    await stockMovement(manager, partId, {
      delta: 5,
      reason: "Stock receipt",
      requestKey: key,
    });
    await stockMovement(manager, partId, {
      delta: 5,
      reason: "Stock receipt",
      requestKey: key,
    });
    expect(
      (await db.inventoryPart.findUniqueOrThrow({ where: { id: partId } }))
        .quantity,
    ).toBe(5);
    await expect(
      stockMovement(tech, partId, {
        delta: -6,
        reason: "Overuse attempt",
        workOrderId: workId,
        requestKey: randomUUID(),
      }),
    ).rejects.toThrow("Insufficient stock");
    await stockMovement(tech, partId, {
      delta: -4,
      reason: "Oil consumed",
      workOrderId: workId,
      requestKey: randomUUID(),
    });
    expect(
      (await db.inventoryPart.findUniqueOrThrow({ where: { id: partId } }))
        .quantity,
    ).toBe(1);
  });
  it("finishes the job, creates history/reminders, snapshots an invoice and prevents overpayment", async () => {
    await workAction(tech, workId, "task", { title: "Oil replacement" });
    const task = await db.workOrderTask.findFirstOrThrow({
      where: { workOrderId: workId },
    });
    await workAction(tech, workId, "task", {
      taskId: task.id,
      title: task.title,
      done: true,
    });
    await workAction(tech, workId, "status", {
      status: "QUALITY_CHECK",
      note: "Tasks complete",
    });
    await expect(
      workAction(tech, workId, "status", {
        status: "READY_FOR_COLLECTION",
        note: "Unauthorized final review",
      }),
    ).rejects.toThrow("manager");
    await workAction(manager, workId, "status", {
      status: "READY_FOR_COLLECTION",
      note: "Final inspection passed",
    });
    expect(
      await db.maintenanceRecord.count({ where: { workOrderId: workId } }),
    ).toBe(1);
    expect(
      (
        await db.maintenanceReminder.findUniqueOrThrow({
          where: { sourceKey: workId },
        })
      ).dueMileage,
    ).toBe(55000);
    const invoice = await issueInvoice(manager, workId);
    expect(invoice.total).toBe(12000);
    expect((await issueInvoice(manager, workId)).id).toBe(invoice.id);
    await expect(
      recordPayment(manager, invoice.id, {
        amount: 12001,
        method: "CASH",
        reference: "TEST",
        requestKey: randomUUID(),
      }),
    ).rejects.toThrow("exceeds");
    const key = randomUUID();
    await recordPayment(manager, invoice.id, {
      amount: 12000,
      method: "CASH",
      reference: "TEST",
      requestKey: key,
    });
    await recordPayment(manager, invoice.id, {
      amount: 12000,
      method: "CASH",
      reference: "TEST",
      requestKey: key,
    });
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(
      1,
    );
    const pdf = await invoicePdf(customer, invoice.id);
    expect(Buffer.from(pdf.bytes).subarray(0, 4).toString()).toBe("%PDF");
    await expect(invoicePdf(other, invoice.id)).rejects.toThrow("not found");
    await expect(invoicePdf(tech, invoice.id)).rejects.toThrow("not found");
    await workAction(manager, workId, "status", {
      status: "DELIVERED",
      note: "Collected by customer",
    });
    await workAction(manager, workId, "status", {
      status: "CLOSED",
      note: "Invoice fully paid",
    });
    expect(
      (await db.workOrder.findUniqueOrThrow({ where: { id: workId } })).status,
    ).toBe("CLOSED");
    expect(
      (await vehicleDetail(customer, vehicleId))?.maintenance,
    ).toHaveLength(1);
  });
});
