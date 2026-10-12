import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { type Actor, manager, centers } from "../policies";
import { check } from "../errors";
import { atomic, audit, notify } from "./shared";
import { accessibleWork } from "./work-orders";
import { money } from "@/lib/utils";
export async function stockMovement(
  user: Actor,
  partId: string,
  body: unknown,
) {
  const input = z
    .object({
      delta: z
        .number()
        .int()
        .min(-100000)
        .max(100000)
        .refine((v) => v !== 0),
      reason: z.string().trim().min(3).max(500),
      workOrderId: z.string().optional(),
      requestKey: z.uuid(),
    })
    .parse(body);
  return atomic(async (tx) => {
    const part = await tx.inventoryPart.findUnique({ where: { id: partId } });
    check(part, "Part not found.", 404);
    check(
      part.active || !input.workOrderId,
      "This part is inactive and cannot be consumed.",
    );
    if (input.workOrderId) {
      const work = await accessibleWork(tx, user, input.workOrderId, true);
      check(
        work.centerId === part.centerId &&
          work.status === "IN_PROGRESS" &&
          input.delta < 0,
        "Parts can be consumed only by an active approved repair in the same center.",
      );
    } else manager(user, part.centerId);
    const previous = await tx.inventoryMovement.findUnique({
      where: { requestKey: input.requestKey },
    });
    if (previous) {
      check(
        previous.partId === partId && previous.actorId === user.id,
        "Duplicate request.",
        409,
      );
      return previous;
    }
    check(part.quantity + input.delta >= 0, "Insufficient stock.", 409);
    await tx.inventoryPart.update({
      where: { id: partId },
      data: { quantity: { increment: input.delta } },
    });
    const result = await tx.inventoryMovement.create({
      data: {
        partId,
        delta: input.delta,
        reason: input.reason,
        requestKey: input.requestKey,
        actorId: user.id,
      },
    });
    if (input.workOrderId)
      await tx.partUsage.create({
        data: {
          partId,
          workOrderId: input.workOrderId,
          quantity: -input.delta,
        },
      });
    await audit(tx, user.id, "STOCK_MOVEMENT", result.id, part.centerId);
    return result;
  });
}
export async function issueInvoice(user: Actor, workOrderId: string) {
  return atomic(async (tx) => {
    const work = await accessibleWork(tx, user, workOrderId);
    manager(user, work.centerId);
    check(
      ["READY_FOR_COLLECTION", "DELIVERED", "CLOSED"].includes(work.status),
      "Complete the quality check before issuing an invoice.",
    );
    const previous = await tx.invoice.findUnique({ where: { workOrderId } });
    if (previous) return previous;
    const estimate = await tx.estimate.findFirst({
      where: { workOrderId },
      orderBy: { version: "desc" },
      include: { items: true },
    });
    check(estimate?.status === "APPROVED", "An approved estimate is required.");
    const snapshot = {
      center: work.center.name,
      address: work.center.address,
      phone: work.center.phone,
      customer: work.appointment.customer.name,
      email: work.appointment.customer.email,
      vehicle: `${work.appointment.vehicle.registration} · ${work.appointment.vehicle.make} ${work.appointment.vehicle.model}`,
      workOrderId,
      estimateId: estimate.id,
      version: estimate.version,
      items: estimate.items.map((i) => ({
        description: i.description,
        kind: i.kind,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      subtotal: estimate.subtotal,
      discount: estimate.discount,
      taxBps: estimate.taxBps,
      tax: estimate.tax,
      total: estimate.total,
      currency: "LKR",
      serviceDate: (work.completedAt ?? new Date()).toISOString(),
    };
    const invoice = await tx.invoice.create({
      data: {
        number: `FF-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        workOrderId,
        total: estimate.total,
        snapshot,
      },
    });
    await notify(
      tx,
      work.appointment.customerId,
      "Invoice issued",
      `${invoice.number} is ready to view and download.`,
      "/dashboard/invoices",
    );
    await audit(tx, user.id, "INVOICE_ISSUED", invoice.id, work.centerId);
    return invoice;
  });
}
export async function recordPayment(
  user: Actor,
  invoiceId: string,
  body: unknown,
) {
  const input = z
    .object({
      amount: z.number().int().positive().max(2_000_000_000),
      method: z.enum(["CASH", "BANK_TRANSFER", "OTHER_MANUAL"]),
      reference: z.string().trim().min(2).max(200),
      requestKey: z.uuid(),
    })
    .parse(body);
  return atomic(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: true,
        workOrder: { include: { appointment: true } },
      },
    });
    check(invoice, "Invoice not found.", 404);
    manager(user, invoice.workOrder.centerId);
    check(!invoice.voided, "This invoice is void.");
    const previous = await tx.payment.findUnique({
      where: { requestKey: input.requestKey },
    });
    if (previous) {
      check(previous.invoiceId === invoiceId, "Duplicate request.", 409);
      return previous;
    }
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    check(
      paid + input.amount <= invoice.total,
      "Payment exceeds the outstanding balance.",
      409,
    );
    const payment = await tx.payment.create({ data: { ...input, invoiceId } });
    await notify(
      tx,
      invoice.workOrder.appointment.customerId,
      "Payment recorded",
      `${money(input.amount)} recorded against ${invoice.number}.`,
      "/dashboard/invoices",
    );
    await audit(
      tx,
      user.id,
      "PAYMENT_RECORDED",
      payment.id,
      invoice.workOrder.centerId,
    );
    return payment;
  });
}
export async function invoicePdf(user: Actor, id: string) {
  const invoice = await db.invoice.findFirst({
    where: {
      id,
      workOrder: {
        OR: [
          { appointment: { customerId: user.id } },
          { centerId: { in: centers(user, "MANAGER") } },
        ],
      },
    },
    include: { payments: true },
  });
  check(invoice, "Invoice not found.", 404);
  const schema = z.object({
    center: z.string(),
    address: z.string(),
    phone: z.string(),
    customer: z.string(),
    email: z.string(),
    vehicle: z.string(),
    items: z.array(
      z.object({
        description: z.string(),
        kind: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      }),
    ),
    subtotal: z.number(),
    discount: z.number(),
    tax: z.number(),
    total: z.number(),
  });
  const data = schema.parse(invoice.snapshot);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const line = (text: string, size = 11, strong = false) => {
    const selectedFont = strong ? bold : font;
    const sanitized = text.replace(/[^\x20-\x7E]/g, " ");
    const rows: string[] = [];
    let row = "";
    for (const char of sanitized) {
      if (selectedFont.widthOfTextAtSize(row + char, size) > 505) {
        rows.push(row);
        row = char;
      } else row += char;
    }
    rows.push(row);
    for (const content of rows) {
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 790;
      }
      page.drawText(content, {
        x: 45,
        y,
        size,
        font: strong ? bold : font,
        color: rgb(0.06, 0.13, 0.2),
      });
      y -= size + 13;
    }
  };
  line("FIXFLOW / SERVICE INVOICE", 22, true);
  line(invoice.number, 13, true);
  line(data.center);
  line(data.address);
  line(data.phone);
  line(`Issued: ${invoice.createdAt.toISOString().slice(0, 10)}`);
  line("");
  line(`Customer: ${data.customer}`);
  line(data.email);
  line(`Vehicle: ${data.vehicle}`);
  line("");
  for (const item of data.items) {
    line(`${item.kind}  ${item.description}`, 11, true);
    line(
      `${item.quantity} x ${money(item.unitPrice)} = ${money(item.quantity * item.unitPrice)}`,
    );
  }
  line("");
  line(`Subtotal: ${money(data.subtotal)}`);
  line(`Discount: ${money(data.discount)}`);
  line(`Tax: ${money(data.tax)}`);
  line(`TOTAL: ${money(data.total)}`, 16, true);
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  line(`Payments recorded: ${money(paid)}`);
  line(`Balance: ${money(data.total - paid)}`, 13, true);
  if (invoice.voided) line("VOID", 20, true);
  line("Manual payments are recorded by the service center.", 9);
  return { bytes: await pdf.save(), number: invoice.number };
}
