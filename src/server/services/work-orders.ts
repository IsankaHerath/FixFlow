import { z } from "zod";
import { addMonths } from "date-fns";
import { WorkStatus } from "../../../generated/prisma/client";
import { type Actor, manager, workScope, centers } from "../policies";
import { check } from "../errors";
import { validateTransition, totals } from "../rules";
import { estimateInput } from "../validation";
import { atomic, audit, notify, centerNotify, type Tx } from "./shared";
export async function accessibleWork(
  tx: Tx,
  user: Actor,
  id: string,
  write = false,
) {
  const work = await tx.workOrder.findFirst({
    where: { id, ...workScope(user) },
    include: {
      appointment: {
        include: { vehicle: true, service: true, customer: true },
      },
      center: true,
    },
  });
  check(work, "Work order not found.", 404);
  if (write)
    check(
      centers(user, "MANAGER").includes(work.centerId) ||
        (work.technicianId === user.id &&
          centers(user, "TECHNICIAN").includes(work.centerId)),
      "Workshop access required.",
      403,
    );
  return work;
}
export async function workAction(
  user: Actor,
  id: string,
  action: string,
  body: unknown,
) {
  return atomic(async (tx) => {
    const work = await accessibleWork(tx, user, id, true);
    check(
      !["CLOSED", "CANCELLED", "DELIVERED"].includes(work.status) ||
        action === "status",
      "This work order is locked.",
      409,
    );
    if (action === "assign") {
      manager(user, work.centerId);
      const { technicianId } = z
        .object({ technicianId: z.string() })
        .parse(body);
      check(
        await tx.membership.findFirst({
          where: {
            userId: technicianId,
            centerId: work.centerId,
            role: "TECHNICIAN",
            active: true,
            user: { active: true },
          },
        }),
        "Select an active technician from this center.",
      );
      await tx.workOrder.update({ where: { id }, data: { technicianId } });
      await notify(
        tx,
        technicianId,
        "Work assigned",
        `Vehicle ${work.appointment.vehicle.registration} is assigned to you.`,
        `/technician/jobs/${id}`,
      );
    } else if (action === "status") {
      const input = z
        .object({
          status: z.nativeEnum(WorkStatus),
          note: z.string().trim().min(3).max(2000),
        })
        .parse(body);
      check(
        !["APPROVED", "AWAITING_ESTIMATE_APPROVAL"].includes(input.status),
        "Use the estimate approval workflow.",
      );
      validateTransition(work.status, input.status);
      if (
        ["READY_FOR_COLLECTION", "DELIVERED", "CLOSED", "CANCELLED"].includes(
          input.status,
        )
      )
        manager(user, work.centerId);
      if (input.status === "INSPECTION")
        check(work.technicianId, "Assign a technician before inspection.");
      if (input.status === "IN_PROGRESS") {
        const estimate = await tx.estimate.findFirst({
          where: { workOrderId: id },
          orderBy: { version: "desc" },
        });
        check(
          estimate?.status === "APPROVED",
          "The latest estimate must be approved before repairs begin.",
          409,
        );
      }
      if (["QUALITY_CHECK", "READY_FOR_COLLECTION"].includes(input.status)) {
        check(
          (await tx.workOrderTask.count({
            where: { workOrderId: id, done: false },
          })) === 0,
          "Complete all repair tasks first.",
        );
        check(
          (await tx.workOrderTask.count({ where: { workOrderId: id } })) > 0,
          "Record at least one completed repair task.",
        );
      }
      if (input.status === "CLOSED") {
        const invoice = await tx.invoice.findUnique({
          where: { workOrderId: id },
          include: { payments: true },
        });
        check(
          invoice &&
            !invoice.voided &&
            invoice.payments.reduce((s, p) => s + p.amount, 0) ===
              invoice.total,
          "Issue and settle the invoice before closing.",
        );
      }
      await tx.workOrder.update({
        where: { id },
        data: {
          status: input.status,
          ...(input.status === "READY_FOR_COLLECTION"
            ? { completedAt: new Date() }
            : {}),
        },
      });
      await tx.workOrderStatusHistory.create({
        data: { workOrderId: id, status: input.status, note: input.note },
      });
      if (input.status === "READY_FOR_COLLECTION") {
        const { vehicle, service } = work.appointment;
        await tx.maintenanceRecord.upsert({
          where: { workOrderId: id },
          update: {},
          create: {
            workOrderId: id,
            vehicleId: vehicle.id,
            mileage: vehicle.mileage,
            summary: service.name,
          },
        });
        if (service.intervalKm || service.intervalMonths)
          await tx.maintenanceReminder.upsert({
            where: { sourceKey: id },
            update: {},
            create: {
              sourceKey: id,
              vehicleId: vehicle.id,
              title: service.name,
              dueMileage: service.intervalKm
                ? vehicle.mileage + service.intervalKm
                : null,
              dueDate: service.intervalMonths
                ? addMonths(new Date(), service.intervalMonths)
                : null,
              explanation: `Based on this service at ${vehicle.mileage} km; configured interval: ${service.intervalKm ?? "—"} km / ${service.intervalMonths ?? "—"} months. A maintenance estimate, not a mechanical prediction.`,
            },
          });
      }
      if (input.status === "CLOSED" || input.status === "CANCELLED")
        await tx.appointment.update({
          where: { id: work.appointmentId },
          data: {
            status: input.status === "CLOSED" ? "COMPLETED" : "CANCELLED",
          },
        });
      await notify(
        tx,
        work.appointment.customerId,
        "Repair progress updated",
        input.note,
        `/dashboard/repairs/${id}`,
      );
    } else if (action === "inspection") {
      check(
        work.status === "INSPECTION",
        "Start inspection before recording findings.",
        409,
      );
      const input = z
        .object({
          mileage: z
            .number()
            .int()
            .min(work.appointment.vehicle.mileage)
            .max(3_000_000),
          findings: z.string().trim().min(5).max(5000),
          severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          checklist: z.record(
            z.string().max(50),
            z.enum(["PASS", "ATTENTION", "NOT_CHECKED"]),
          ),
        })
        .parse(body);
      await tx.inspection.create({
        data: { ...input, authorId: user.id, workOrderId: id },
      });
      await tx.vehicle.update({
        where: { id: work.appointment.vehicleId },
        data: { mileage: input.mileage },
      });
      await tx.mileageRecord.create({
        data: {
          vehicleId: work.appointment.vehicleId,
          mileage: input.mileage,
          note: "Workshop inspection",
        },
      });
      await notify(
        tx,
        work.appointment.customerId,
        "Inspection recorded",
        input.findings,
        `/dashboard/repairs/${id}`,
      );
    } else if (action === "task") {
      check(
        ["INSPECTION", "APPROVED", "IN_PROGRESS"].includes(work.status),
        "Tasks cannot change at this stage.",
      );
      const input = z
        .object({
          title: z.string().trim().min(3).max(500),
          taskId: z.string().optional(),
          done: z.boolean().default(false),
        })
        .parse(body);
      if (input.done)
        check(
          work.status === "IN_PROGRESS",
          "Start approved repairs before completing tasks.",
        );
      if (input.taskId) {
        const count = await tx.workOrderTask.updateMany({
          where: { id: input.taskId, workOrderId: id },
          data: { done: input.done },
        });
        check(count.count === 1, "Task not found.", 404);
      } else
        await tx.workOrderTask.create({
          data: { title: input.title, done: false, workOrderId: id },
        });
    } else if (action === "labor") {
      check(
        work.status === "IN_PROGRESS",
        "Labor can be recorded during approved repairs only.",
      );
      const input = z
        .object({
          description: z.string().trim().min(3).max(500),
          minutes: z.number().int().min(1).max(1440),
        })
        .parse(body);
      await tx.laborEntry.create({ data: { ...input, workOrderId: id } });
    } else check(false, "Unknown work order action.", 404);
    await audit(tx, user.id, `WORK_${action.toUpperCase()}`, id, work.centerId);
    return { id };
  });
}
export async function createEstimate(
  user: Actor,
  workOrderId: string,
  body: unknown,
) {
  const input = estimateInput.parse(body);
  check(
    new Date(input.expiresAt) > new Date(),
    "Estimate expiration must be in the future.",
  );
  return atomic(async (tx) => {
    const work = await accessibleWork(tx, user, workOrderId);
    manager(user, work.centerId);
    check(
      [
        "INSPECTION",
        "AWAITING_ESTIMATE_APPROVAL",
        "APPROVED",
        "IN_PROGRESS",
      ].includes(work.status),
      "Estimates cannot change at this stage.",
    );
    check(
      (await tx.inspection.count({ where: { workOrderId } })) > 0,
      "Record an inspection first.",
    );
    const latest = await tx.estimate.findFirst({
      where: { workOrderId },
      orderBy: { version: "desc" },
    });
    // Approved versions remain immutable; only supersede undecided/rejected versions.
    await tx.estimate.updateMany({
      where: { workOrderId, status: { in: ["SENT", "REJECTED"] } },
      data: { status: "SUPERSEDED" },
    });
    const estimate = await tx.estimate.create({
      data: {
        workOrderId,
        version: (latest?.version ?? 0) + 1,
        ...totals(input.items, input.discount, input.taxBps),
        discount: input.discount,
        taxBps: input.taxBps,
        notes: input.notes,
        expiresAt: new Date(input.expiresAt),
        items: { create: input.items },
      },
    });
    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { status: "AWAITING_ESTIMATE_APPROVAL" },
    });
    await tx.workOrderStatusHistory.create({
      data: {
        workOrderId,
        status: "AWAITING_ESTIMATE_APPROVAL",
        note: `Estimate version ${estimate.version} sent. Work paused pending approval.`,
      },
    });
    await notify(
      tx,
      work.appointment.customerId,
      "Estimate ready for review",
      `Review estimate version ${estimate.version} before work proceeds.`,
      `/dashboard/repairs/${workOrderId}`,
    );
    await audit(tx, user.id, "ESTIMATE_SENT", estimate.id, work.centerId);
    return estimate;
  });
}
export async function decideEstimate(user: Actor, id: string, body: unknown) {
  const { approved } = z.object({ approved: z.boolean() }).parse(body);
  return atomic(async (tx) => {
    const estimate = await tx.estimate.findUnique({
      where: { id },
      include: { workOrder: { include: { appointment: true } } },
    });
    check(
      estimate && estimate.workOrder.appointment.customerId === user.id,
      "Estimate not found.",
      404,
    );
    check(
      estimate.status === "SENT" &&
        estimate.expiresAt > new Date() &&
        estimate.workOrder.status === "AWAITING_ESTIMATE_APPROVAL",
      "This estimate is no longer awaiting approval.",
      409,
    );
    const latest = await tx.estimate.findFirst({
      where: { workOrderId: estimate.workOrderId },
      orderBy: { version: "desc" },
    });
    check(latest?.id === id, "A newer estimate requires your review.", 409);
    await tx.estimateApproval.create({
      data: { estimateId: id, customerId: user.id, approved },
    });
    await tx.estimate.update({
      where: { id },
      data: { status: approved ? "APPROVED" : "REJECTED" },
    });
    if (approved)
      await tx.workOrder.update({
        where: { id: estimate.workOrderId },
        data: { status: "APPROVED" },
      });
    await tx.workOrderStatusHistory.create({
      data: {
        workOrderId: estimate.workOrderId,
        status: approved ? "APPROVED" : "AWAITING_ESTIMATE_APPROVAL",
        note: `Customer ${approved ? "approved" : "rejected"} estimate version ${estimate.version}.`,
      },
    });
    await audit(
      tx,
      user.id,
      approved ? "ESTIMATE_APPROVED" : "ESTIMATE_REJECTED",
      id,
      estimate.workOrder.centerId,
    );
    await centerNotify(
      tx,
      estimate.workOrder.centerId,
      approved ? "Estimate approved" : "Estimate rejected",
      `Customer decision recorded for estimate version ${estimate.version}.`,
    );
    return { id, approved };
  });
}
