import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  actor,
  admin,
  manager,
  centers,
  vehicleScope,
} from "@/server/policies";
import { check, errorResponse } from "@/server/errors";
import { saveVehicle, archiveVehicle } from "@/server/services/vehicles";
import {
  availability,
  book,
  updateAppointment,
} from "@/server/services/appointments";
import {
  createEstimate,
  decideEstimate,
  workAction,
} from "@/server/services/work-orders";
import {
  invoicePdf,
  issueInvoice,
  recordPayment,
  stockMovement,
} from "@/server/services/finance";
import { createStaff } from "@/server/services/admin";
import { workspace, workDetail } from "@/server/services/queries";
import { centerInput, serviceInput, partInput } from "@/server/validation";
import { atomic, audit } from "@/server/services/shared";
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: NextRequest, context: Context) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;
    const read = req.method === "GET";
    if (!read)
      check(
        req.headers.get("origin") ===
          new URL(process.env.BETTER_AUTH_URL ?? req.url).origin,
        "Invalid request origin.",
        403,
      );
    if (resource === "service-centers" && read)
      return Response.json({
        data: await db.serviceCenter.findMany({
          where: { active: true, ...(id ? { id } : {}) },
          include: { services: { where: { active: true } } },
          take: 100,
        }),
      });
    if (resource === "appointments" && id === "availability" && read)
      return Response.json({
        data: await availability(
          req.nextUrl.searchParams.get("centerId") ?? "",
          req.nextUrl.searchParams.get("serviceId") ?? "",
          req.nextUrl.searchParams.get("date") ?? "",
        ),
      });
    const user = await actor(req.headers);
    if (resource === "reports" && id === "export" && read) {
      check(
        centers(user, "MANAGER").length > 0,
        "Center manager access required.",
        403,
      );
      const report = await workspace(user);
      const months = [
        ...new Set([
          ...report.monthlyRevenue.map((r) => r.month),
          ...report.monthlyAppointments.map((r) => r.month),
        ]),
      ].sort();
      const csv = [
        "Month,Recorded revenue (LKR),Appointments",
        ...months.map(
          (month) =>
            `${month},${(report.monthlyRevenue.find((r) => r.month === month)?.amount ?? 0).toFixed(2)},${report.monthlyAppointments.find((r) => r.month === month)?.count ?? 0}`,
        ),
      ].join("\r\n");
      return new Response(csv + "\r\n", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="fixflow-monthly-report.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    const body: unknown =
      read || req.method === "DELETE" ? {} : await req.json();
    let data: unknown;
    if (resource === "workspace" && read)
      data = await workspace(
        user,
        z.coerce
          .number()
          .int()
          .min(1)
          .max(10000)
          .parse(req.nextUrl.searchParams.get("page") ?? 1),
        (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100),
      );
    else if (resource === "vehicles") {
      if (read)
        data = await db.vehicle.findMany({
          where: { ...vehicleScope(user), ...(id ? { id } : {}) },
          include: {
            mileageRecords: { orderBy: { createdAt: "desc" }, take: 30 },
          },
          take: 20,
        });
      else if (req.method === "DELETE" && id)
        data = await archiveVehicle(user, id);
      else if (["POST", "PATCH"].includes(req.method))
        data = await saveVehicle(user, body, id);
    } else if (resource === "appointments" && req.method === "POST")
      data = await book(user, body, id);
    else if (resource === "appointments" && id && req.method === "PATCH")
      data = await updateAppointment(user, id, body);
    else if (resource === "work-orders" && id) {
      if (read) {
        data = await workDetail(user, id);
        check(data, "Work order not found.", 404);
      } else if (req.method === "POST" && action === "estimate")
        data = await createEstimate(user, id, body);
      else if (req.method === "POST" && action === "invoice")
        data = await issueInvoice(user, id);
      else if (req.method === "POST" && action)
        data = await workAction(user, id, action, body);
    } else if (
      resource === "estimates" &&
      id &&
      action === "decision" &&
      req.method === "POST"
    )
      data = await decideEstimate(user, id, body);
    else if (resource === "invoices" && id) {
      if (action === "pdf" && read) {
        const pdf = await invoicePdf(user, id);
        return new Response(Buffer.from(pdf.bytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${pdf.number}.pdf"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (action === "payments" && req.method === "POST")
        data = await recordPayment(user, id, body);
      if (action === "void" && req.method === "POST")
        data = await atomic(async (tx) => {
          const invoice = await tx.invoice.findUnique({
            where: { id },
            include: { workOrder: true, payments: true },
          });
          check(invoice, "Invoice not found.", 404);
          manager(user, invoice.workOrder.centerId);
          check(
            !invoice.payments.length && !invoice.voided,
            "Only unpaid, active invoices can be voided.",
          );
          const { reason } = z
            .object({ reason: z.string().trim().min(5).max(500) })
            .parse(body);
          await audit(
            tx,
            user.id,
            "INVOICE_VOID",
            id,
            invoice.workOrder.centerId,
          );
          return tx.invoice.update({
            where: { id },
            data: { voided: true, voidReason: reason },
          });
        });
    } else if (
      resource === "inventory" &&
      id &&
      action === "movement" &&
      req.method === "POST"
    )
      data = await stockMovement(user, id, body);
    else if (resource === "inventory" && req.method === "POST") {
      const { centerId } = z.object({ centerId: z.string() }).parse(body);
      manager(user, centerId);
      data = await db.inventoryPart.create({
        data: { ...partInput.parse(body), centerId },
      });
    } else if (resource === "inventory" && id && req.method === "PATCH") {
      const part = await db.inventoryPart.findUnique({ where: { id } });
      check(part, "Part not found.", 404);
      manager(user, part.centerId);
      const input = partInput.extend({ active: z.boolean() }).parse(body);
      data = await atomic(async (tx) => {
        await audit(tx, user.id, "PART_UPDATED", id, part.centerId);
        return tx.inventoryPart.update({ where: { id }, data: input });
      });
    } else if (
      resource === "services" &&
      ["POST", "PATCH"].includes(req.method)
    ) {
      const { centerId } = z.object({ centerId: z.string() }).parse(body);
      manager(user, centerId);
      const input = serviceInput.parse(body);
      if (id) {
        check(
          await db.service.findFirst({ where: { id, centerId } }),
          "Service not found.",
          404,
        );
        data = await db.service.update({ where: { id }, data: input });
      } else data = await db.service.create({ data: { ...input, centerId } });
    } else if (resource === "staff" && req.method === "POST")
      data = await createStaff(user, body);
    else if (resource === "staff" && id && req.method === "PATCH") {
      const input = z
        .object({ active: z.boolean(), specializations: z.string().max(500) })
        .parse(body);
      const membership = await db.membership.findUnique({ where: { id } });
      check(membership?.role === "TECHNICIAN", "Technician not found.", 404);
      manager(user, membership.centerId);
      data = await db.membership.update({ where: { id }, data: input });
    } else if (resource === "centers" && req.method === "POST") {
      admin(user);
      data = await atomic(async (tx) => {
        const center = await tx.serviceCenter.create({
          data: { ...centerInput.parse(body), active: false },
        });
        await audit(
          tx,
          user.id,
          "CENTER_CREATED_PENDING_APPROVAL",
          center.id,
          center.id,
        );
        return center;
      });
    } else if (resource === "centers" && id && req.method === "PATCH") {
      if (user.role === "SUPER_ADMIN") {
        const input = z.object({ active: z.boolean() }).parse(body);
        data = await atomic(async (tx) => {
          await audit(tx, user.id, "CENTER_STATUS", id, id);
          const current = await tx.serviceCenter.findUnique({ where: { id } });
          check(current, "Center not found.", 404);
          return tx.serviceCenter.update({
            where: { id },
            data: {
              ...input,
              ...(input.active && !current.approvedAt
                ? { approvedAt: new Date() }
                : {}),
            },
          });
        });
      } else {
        manager(user, id);
        data = await db.serviceCenter.update({
          where: { id },
          data: centerInput.parse(body),
        });
      }
    } else if (resource === "users" && id && req.method === "PATCH") {
      admin(user);
      check(id !== user.id, "You cannot deactivate your own account.");
      const input = z.object({ active: z.boolean() }).parse(body);
      data = await atomic(async (tx) => {
        await audit(tx, user.id, "USER_STATUS", id);
        if (!input.active)
          await tx.session.deleteMany({ where: { userId: id } });
        return tx.user.update({
          where: { id },
          data: input,
          select: { id: true, active: true },
        });
      });
    } else if (resource === "profile" && req.method === "PATCH")
      data = await db.user.update({
        where: { id: user.id },
        data: z
          .object({
            name: z.string().trim().min(2).max(100),
            phone: z.string().max(30),
            emailNotifications: z.boolean(),
          })
          .parse(body),
        select: { id: true, name: true },
      });
    else if (resource === "notifications" && req.method === "PATCH")
      data = await db.notification.updateMany({
        where: { userId: user.id, ...(id && id !== "all" ? { id } : {}) },
        data: { read: true },
      });
    else if (resource === "reminders" && id && req.method === "PATCH")
      data = await db.maintenanceReminder.updateMany({
        where: { id, vehicle: { ownerId: user.id } },
        data: { dismissed: true },
      });
    else if (resource === "mileage-correction" && id && req.method === "POST") {
      const input = z
        .object({
          mileage: z.number().int().min(0).max(3_000_000),
          reason: z.string().trim().min(10).max(1000),
        })
        .parse(body);
      data = await atomic(async (tx) => {
        const activeJob = await tx.workOrder.findFirst({
          where: {
            centerId: { in: centers(user, "MANAGER") },
            appointment: { vehicleId: id },
            status: { in: ["RECEIVED", "INSPECTION"] },
          },
        });
        check(
          activeJob,
          "Mileage corrections require an active inspection at your center.",
          403,
        );
        await audit(
          tx,
          user.id,
          `MILEAGE_CORRECTION: ${input.reason}`,
          id,
          activeJob.centerId,
        );
        await tx.mileageRecord.create({
          data: {
            vehicleId: id,
            mileage: input.mileage,
            note: `Correction: ${input.reason}`,
          },
        });
        return tx.vehicle.update({
          where: { id },
          data: { mileage: input.mileage },
        });
      });
    }
    check(data !== undefined, "Endpoint or method not found.", 404);
    return Response.json(
      { data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
