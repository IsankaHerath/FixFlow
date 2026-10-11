import { db } from "@/lib/db";
import {
  type Actor,
  appointmentScope,
  workScope,
  centers,
  vehicleScope,
} from "../policies";
import { reminderState } from "../rules";
import { Prisma } from "../../../generated/prisma/client";
export async function workspace(user: Actor, page = 1, search = "") {
  const skip = (page - 1) * 20;
  const managerIds = centers(user, "MANAGER");
  const financeScope = {
    OR: [
      { appointment: { customerId: user.id } },
      { centerId: { in: managerIds } },
    ],
  };
  const [
    vehicles,
    appointments,
    jobs,
    estimates,
    invoices,
    inventory,
    services,
    technicians,
    notifications,
    reminders,
    history,
    centerList,
    audit,
    users,
    counts,
  ] = await Promise.all([
    db.vehicle.findMany({
      where: {
        ...vehicleScope(user),
        ...(search
          ? {
              OR: [
                { registration: { contains: search, mode: "insensitive" } },
                { make: { contains: search, mode: "insensitive" } },
              ],
              AND: [vehicleScope(user)],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip,
    }),
    db.appointment.findMany({
      where: { ...appointmentScope(user) },
      include: {
        vehicle: true,
        service: true,
        center: { select: { name: true } },
        customer: { select: { name: true } },
        workOrder: { select: { id: true } },
      },
      orderBy: { startsAt: "desc" },
      take: 20,
      skip,
    }),
    db.workOrder.findMany({
      where: workScope(user),
      include: {
        appointment: { include: { vehicle: true, service: true } },
        technician: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      skip,
    }),
    db.estimate.findMany({
      where: { workOrder: financeScope },
      include: {
        items: true,
        workOrder: { include: { appointment: { include: { vehicle: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip,
    }),
    db.invoice.findMany({
      where: { workOrder: financeScope },
      include: {
        payments: true,
        workOrder: {
          include: {
            appointment: {
              include: { vehicle: true, customer: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip,
    }),
    db.inventoryPart.findMany({
      where: {
        centerId: { in: managerIds },
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      include: { movements: { take: 5, orderBy: { createdAt: "desc" } } },
      take: 20,
      skip,
      orderBy: { name: "asc" },
    }),
    db.service.findMany({
      where: { centerId: { in: managerIds } },
      include: { center: { select: { name: true } } },
      take: 20,
      skip,
      orderBy: { name: "asc" },
    }),
    db.membership.findMany({
      where: { centerId: { in: managerIds }, role: "TECHNICIAN" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            _count: {
              select: {
                assignments: {
                  where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
                },
              },
            },
          },
        },
      },
      take: 20,
      skip,
    }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip,
    }),
    db.maintenanceReminder.findMany({
      where: { vehicle: { ownerId: user.id } },
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip,
    }),
    db.maintenanceRecord.findMany({
      where: { vehicle: { ownerId: user.id } },
      include: {
        vehicle: true,
        workOrder: {
          include: {
            center: { select: { name: true } },
            invoice: { select: { id: true, total: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip,
    }),
    db.serviceCenter.findMany({
      where: user.role === "SUPER_ADMIN" ? {} : { active: true },
      include: { services: { where: { active: true }, take: 100 } },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.activityLog.findMany({
      where:
        user.role === "SUPER_ADMIN" ? {} : { centerId: { in: managerIds } },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip,
    }),
    user.role === "SUPER_ADMIN"
      ? db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
          },
          take: 20,
          skip,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    Promise.all([
      db.vehicle.count({ where: { ...vehicleScope(user), archived: false } }),
      db.appointment.count({
        where: {
          ...appointmentScope(user),
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { gte: new Date() },
        },
      }),
      db.workOrder.count({
        where: {
          ...workScope(user),
          status: { notIn: ["CLOSED", "CANCELLED", "DELIVERED"] },
        },
      }),
      db.estimate.count({
        where: {
          workOrder: financeScope,
          status: "SENT",
          expiresAt: { gt: new Date() },
        },
      }),
      db.notification.count({ where: { userId: user.id, read: false } }),
    ]),
  ]);
  const revenue = managerIds.length
    ? await db.payment.groupBy({
        by: ["method"],
        where: {
          invoice: {
            voided: false,
            workOrder: { centerId: { in: managerIds } },
          },
        },
        _sum: { amount: true },
        _count: true,
      })
    : [];
  const availableParts = await db.inventoryPart.findMany({ where: { centerId: { in: centers(user) }, active: true }, select: { id: true, name: true, quantity: true, centerId: true }, take: 100, orderBy: { name: "asc" } });
  const distribution = await db.workOrder.groupBy({
    by: ["status"],
    where: workScope(user),
    _count: true,
  });
  const platform =
    user.role === "SUPER_ADMIN"
      ? {
          users: await db.user.count(),
          centers: await db.serviceCenter.count(),
          appointments: await db.appointment.count(),
          jobs: await db.workOrder.count(),
        }
      : null;
  const monthlyRevenue = managerIds.length ? await db.$queryRaw<{ month: string; amount: number }[]>`
    SELECT to_char(p."createdAt" AT TIME ZONE 'Asia/Colombo', 'YYYY-MM') AS month,
           (sum(p.amount)::numeric / 100)::float8 AS amount
    FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
    JOIN "WorkOrder" w ON w.id = i."workOrderId"
    WHERE w."centerId" IN (${Prisma.join(managerIds)}) AND NOT i.voided
      AND p."createdAt" >= date_trunc('month', NOW()) - INTERVAL '11 months'
    GROUP BY month ORDER BY month` : [];
  const monthlyAppointments = managerIds.length ? await db.$queryRaw<{month:string;count:number}[]>`
    SELECT to_char("startsAt" AT TIME ZONE 'Asia/Colombo','YYYY-MM') AS month, count(*)::int AS count
    FROM "Appointment" WHERE "centerId" IN (${Prisma.join(managerIds)})
      AND "startsAt" >= date_trunc('month', NOW()) - INTERVAL '11 months'
      AND "startsAt" < date_trunc('month', NOW()) + INTERVAL '1 month'
    GROUP BY month ORDER BY month` : [];
  const balances = managerIds.length ? await db.$queryRaw<{outstanding:number}[]>`
    SELECT coalesce(sum(i.total - coalesce(p.paid,0)),0)::float8 AS outstanding FROM "Invoice" i
    JOIN "WorkOrder" w ON w.id=i."workOrderId"
    LEFT JOIN (SELECT "invoiceId",sum(amount) AS paid FROM "Payment" GROUP BY "invoiceId") p ON p."invoiceId"=i.id
    WHERE NOT i.voided AND w."centerId" IN (${Prisma.join(managerIds)})` : [];
  return {
    monthlyRevenue, monthlyAppointments, outstanding: balances[0]?.outstanding ?? 0,
    availableParts,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailNotifications: user.emailNotifications,
    },
    managerIds,
    vehicles,
    appointments,
    jobs,
    estimates,
    invoices,
    inventory,
    services,
    technicians,
    notifications,
    reminders: reminders.map((r) => ({
      ...r,
      state: r.dismissed
        ? "DISMISSED"
        : reminderState(r.dueMileage, r.vehicle.mileage, r.dueDate),
    })),
    history,
    centers: centerList,
    audit,
    users,
    stats: {
      vehicles: counts[0],
      appointments: counts[1],
      jobs: counts[2],
      estimates: counts[3],
      unread: counts[4],
    },
    revenue,
    distribution,
    platform,
    page,
  };
}
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
export type WorkspaceData = Serialized<Awaited<ReturnType<typeof workspace>>>;
export async function workDetail(user: Actor, id: string) {
  const work = await db.workOrder.findFirst({
    where: { id, ...workScope(user) },
    include: {
      appointment: {
        include: {
          vehicle: true,
          service: true,
          customer: { select: { name: true } },
        },
      },
      center: { select: { name: true } },
      technician: { select: { name: true } },
      history: { orderBy: { createdAt: "asc" } },
      tasks: true,
      inspections: true,
      labor: true,
      partUsage: { include: { part: { select: { name: true } } } },
      estimates: { include: { items: true }, orderBy: { version: "desc" } },
      invoice: { include: { payments: true } },
    },
  });
  return work
    ? {
        ...work,
        estimates: user.role === "TECHNICIAN" ? [] : work.estimates,
        invoice: user.role === "TECHNICIAN" ? null : work.invoice,
      }
    : null;
}
export type WorkDetailData = Serialized<
  NonNullable<Awaited<ReturnType<typeof workDetail>>>
>;
