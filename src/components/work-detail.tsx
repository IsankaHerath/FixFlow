"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { WorkspaceData, WorkDetailData } from "@/server/services/queries";
import { date, money, label } from "@/lib/utils";
import { Shell } from "./shell";
import { Badge, Empty } from "./workspace";
import { ActionForm, ActionButton, mutate } from "./forms";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { parseMoney } from "@/lib/money";
const steps: Record<string, string[]> = {
  RECEIVED: ["INSPECTION", "CANCELLED"],
  INSPECTION: ["CANCELLED"],
  AWAITING_ESTIMATE_APPROVAL: ["CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["QUALITY_CHECK"],
  QUALITY_CHECK: ["IN_PROGRESS", "READY_FOR_COLLECTION"],
  READY_FOR_COLLECTION: ["DELIVERED"],
  DELIVERED: ["CLOSED"],
};
function EstimateForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([
    { description: "", kind: "LABOR", quantity: 1, unitPrice: "0.00" },
  ]);
  const router = useRouter();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Prepare estimate
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Prepare a repair estimate"
      >
        <p className="notice">
          A new version includes the entire job total and requires fresh
          approval. Existing approved versions remain on record.
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              await mutate(`/api/work-orders/${id}/estimate`, {
                items: items.map((i) => ({
                  ...i,
                  unitPrice: parseMoney(i.unitPrice),
                })),
                discount: parseMoney(String(form.get("discount"))),
                taxBps: Number(form.get("taxBps")),
                notes: String(form.get("notes")),
                expiresAt: new Date(
                  `${form.get("expiresAt")}T23:59:59+05:30`,
                ).toISOString(),
              });
              toast.success("Estimate sent for approval");
              setOpen(false);
              router.refresh();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Unable to send estimate",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="estimate-lines">
            {items.map((item, index) => (
              <div key={index} className="estimate-line">
                <div className="form-grid">
                  <label className="field full">
                    Description
                    <input
                      required
                      value={item.description}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? { ...x, description: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Type
                    <select
                      value={item.kind}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index ? { ...x, kind: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option>LABOR</option>
                      <option>PART</option>
                    </select>
                  </label>
                  <label className="field">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      required
                      value={item.quantity}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? { ...x, quantity: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Unit price (LKR)
                    <input
                      type="text"
                      inputMode="decimal"
                      min={0}
                      required
                      value={item.unitPrice}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? { ...x, unitPrice: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={15} />
                    Remove item
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setItems([
                ...items,
                {
                  description: "",
                  kind: "PART",
                  quantity: 1,
                  unitPrice: "0.00",
                },
              ])
            }
          >
            <Plus size={15} />
            Add line item
          </Button>
          <div className="form-grid">
            <label className="field">
              Discount (LKR)
              <input
                name="discount"
                type="text"
                inputMode="decimal"
                min={0}
                defaultValue={0}
                required
              />
            </label>
            <label className="field">
              Tax (basis points; 100 = 1%)
              <input
                name="taxBps"
                type="number"
                min={0}
                max={10000}
                defaultValue={0}
                required
              />
            </label>
            <label className="field">
              Valid until (Colombo time)
              <input type="date" name="expiresAt" required />
            </label>
            <label className="field">
              Notes
              <textarea name="notes" />
            </label>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" disabled={busy}>
            Send estimate for approval
          </Button>
        </form>
      </Dialog>
    </>
  );
}
export function WorkDetail({
  data,
  work,
  base,
}: {
  data: WorkspaceData;
  work: WorkDetailData;
  base: string;
}) {
  const router = useRouter();
  const isCustomer = base === "/dashboard";
  const isManager = base === "/manager";
  const canWrite = !isCustomer;
  const open = !["CLOSED", "CANCELLED", "DELIVERED"].includes(work.status);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);
  const next = (steps[work.status] ?? []).filter(
    (s) =>
      isManager ||
      !["READY_FOR_COLLECTION", "DELIVERED", "CLOSED", "CANCELLED"].includes(s),
  );
  return (
    <Shell data={data} base={base}>
      <Link
        className="text-link muted"
        href={`${base}/${isCustomer ? "repairs" : isManager ? "work-orders" : "jobs"}`}
      >
        ← Back to repairs
      </Link>
      <div className="detail-header" style={{ marginTop: 20 }}>
        <div>
          <h1>
            {work.appointment.vehicle.make} {work.appointment.vehicle.model}
          </h1>
          <p>
            {work.appointment.vehicle.registration} ·{" "}
            {work.appointment.service.name} · {work.center.name}
          </p>
        </div>
        <Badge value={work.status} />
      </div>
      <div className="toolbar">
        <p className="code-note">
          Updates refresh every 30 seconds ·{" "}
          {work.technician?.name ?? "Awaiting technician assignment"}
        </p>
        <div className="inline-actions">
          {isManager && open && (
            <ActionForm
              title="Assign technician"
              endpoint={`/api/work-orders/${work.id}/assign`}
              fields={[
                {
                  name: "technicianId",
                  label: "Technician",
                  options: data.technicians
                    .filter((t) => t.active && t.centerId === work.centerId)
                    .map((t) => ({ value: t.userId, label: t.user.name })),
                },
              ]}
            />
          )}
          {canWrite && next.length > 0 && (
            <ActionForm
              title="Update repair status"
              endpoint={`/api/work-orders/${work.id}/status`}
              fields={[
                {
                  name: "status",
                  label: "Next stage",
                  options: next.map((value) => ({
                    value,
                    label: label(value),
                  })),
                },
                { name: "note", label: "Progress note", type: "textarea" },
              ]}
            />
          )}
          {isManager &&
            [
              "INSPECTION",
              "AWAITING_ESTIMATE_APPROVAL",
              "APPROVED",
              "IN_PROGRESS",
            ].includes(work.status) && <EstimateForm id={work.id} />}
          {isManager &&
            ["READY_FOR_COLLECTION", "DELIVERED"].includes(work.status) &&
            !work.invoice && (
              <ActionButton
                endpoint={`/api/work-orders/${work.id}/invoice`}
                confirm
              >
                Issue invoice
              </ActionButton>
            )}
        </div>
      </div>
      <div className="dashboard-grid">
        <div>
          <div className="panel">
            <div className="panel-heading">
              <h2>Inspection & findings</h2>
              {canWrite && work.status === "INSPECTION" && (
                <ActionForm
                  title="Record inspection"
                  endpoint={`/api/work-orders/${work.id}/inspection`}
                  fields={[
                    {
                      name: "mileage",
                      label: "Vehicle mileage (km)",
                      type: "number",
                      min: work.appointment.vehicle.mileage,
                      value: work.appointment.vehicle.mileage,
                    },
                    {
                      name: "severity",
                      label: "Severity",
                      options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
                        (value) => ({ value, label: value }),
                      ),
                    },
                    {
                      name: "findings",
                      label: "Findings & recommendations",
                      type: "textarea",
                    },
                    ...[
                      "Engine",
                      "Brakes",
                      "Tires",
                      "Battery",
                      "Fluids",
                      "Suspension",
                      "Lights",
                      "Electrical",
                      "Air conditioning",
                    ].map((name) => ({
                      name,
                      label: name,
                      options: ["PASS", "ATTENTION", "NOT_CHECKED"].map(
                        (value) => ({ value, label: label(value) }),
                      ),
                      value: "NOT_CHECKED",
                    })),
                  ]}
                  transform={(d) => ({
                    mileage: d.mileage,
                    severity: d.severity,
                    findings: d.findings,
                    checklist: Object.fromEntries(
                      Object.entries(d).filter(
                        ([k]) =>
                          !["mileage", "severity", "findings"].includes(k),
                      ),
                    ),
                  })}
                />
              )}
            </div>
            <p className="muted">
              Reported concern: {work.appointment.description}
            </p>
            {work.inspections.length ? (
              work.inspections.map((i) => (
                <div key={i.id} style={{ marginTop: 20 }}>
                  <Badge value={i.severity} />
                  <p style={{ marginTop: 10 }}>{i.findings}</p>
                  <p className="code-note">
                    {date(i.createdAt)} · {i.mileage.toLocaleString()} km
                  </p>
                  <div className="inline-actions">
                    {Object.entries(i.checklist ?? {}).map(([name, value]) => (
                      <span className="badge" key={name}>
                        {name}: {String(value)}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="Inspection pending"
                text="Your technician’s findings will be recorded here."
              />
            )}
          </div>
          <div className="panel">
            <div className="panel-heading">
              <h2>Repair tasks</h2>
              {canWrite &&
                ["INSPECTION", "APPROVED", "IN_PROGRESS"].includes(
                  work.status,
                ) && (
                  <ActionForm
                    title="Add repair task"
                    endpoint={`/api/work-orders/${work.id}/task`}
                    fields={[{ name: "title", label: "Task description" }]}
                  />
                )}
            </div>
            {work.tasks.length ? (
              work.tasks.map((t) => (
                <div className="list-row" key={t.id}>
                  <div>
                    <h3>{t.title}</h3>
                    <Badge value={t.done ? "COMPLETED" : "PENDING"} />
                  </div>
                  {canWrite && work.status === "IN_PROGRESS" && (
                    <ActionButton
                      endpoint={`/api/work-orders/${work.id}/task`}
                      body={{ taskId: t.id, title: t.title, done: !t.done }}
                    >
                      {t.done ? "Reopen" : "Mark complete"}
                    </ActionButton>
                  )}
                </div>
              ))
            ) : (
              <Empty title="No repair tasks recorded" />
            )}
          </div>
          {canWrite && (
            <div className="panel">
              <div className="panel-heading">
                <h2>Labor & parts used</h2>
                {work.status === "IN_PROGRESS" && (
                  <ActionForm
                    title="Record labor"
                    endpoint={`/api/work-orders/${work.id}/labor`}
                    fields={[
                      { name: "description", label: "Work performed" },
                      {
                        name: "minutes",
                        label: "Time spent (minutes)",
                        type: "number",
                        min: 1,
                      },
                    ]}
                  />
                )}
              </div>
              {work.labor.map((l) => (
                <div className="list-row" key={l.id}>
                  <div>
                    <h3>{l.description}</h3>
                    <p>
                      {l.minutes} minutes · {date(l.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {work.partUsage.map((p) => (
                <div className="list-row" key={p.id}>
                  <div>
                    <h3>{p.part.name}</h3>
                    <p>{p.quantity} units consumed</p>
                  </div>
                </div>
              ))}
              {work.status === "IN_PROGRESS" && (
                <div style={{ marginTop: 20 }}>
                  {data.availableParts
                    .filter((p) => p.centerId === work.centerId)
                    .map((p) => (
                      <div className="list-row" key={p.id}>
                        <div>
                          <h3>{p.name}</h3>
                          <p>{p.quantity} units available</p>
                        </div>
                        <ActionForm
                          title="Record parts used"
                          endpoint={`/api/inventory/${p.id}/movement`}
                          extra={{ workOrderId: work.id }}
                          fields={[
                            {
                              name: "delta",
                              label: "Quantity to consume",
                              type: "number",
                              min: 1,
                              max: p.quantity,
                            },
                            { name: "reason", label: "Usage note" },
                          ]}
                          transform={(d) => ({
                            ...d,
                            delta: -Number(d.delta),
                            requestKey: crypto.randomUUID(),
                          })}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
          {work.estimates?.length > 0 && (
            <div className="panel">
              <h2 style={{ fontSize: 18 }}>Estimate versions</h2>
              {work.estimates.map((e) => (
                <div
                  key={e.id}
                  style={{
                    borderBottom: "1px solid var(--line)",
                    padding: "20px 0",
                  }}
                >
                  <div className="panel-heading">
                    <h2>Version {e.version}</h2>
                    <Badge value={e.status} />
                  </div>
                  {e.items.map((i) => (
                    <div className="list-row" key={i.id}>
                      <div>
                        <h3>{i.description}</h3>
                        <p>
                          {i.quantity} × {money(i.unitPrice)} · {label(i.kind)}
                        </p>
                      </div>
                      <strong>{money(i.quantity * i.unitPrice)}</strong>
                    </div>
                  ))}
                  <p className="code-note">
                    Discount {money(e.discount)} · Tax {money(e.tax)} · Expires{" "}
                    {date(e.expiresAt)}
                  </p>
                  <p className="money-total">{money(e.total)}</p>
                  {isCustomer &&
                    e.status === "SENT" &&
                    new Date(e.expiresAt) > new Date() && (
                      <div className="inline-actions">
                        <ActionButton
                          endpoint={`/api/estimates/${e.id}/decision`}
                          body={{ approved: true }}
                          confirm
                        >
                          Approve estimate
                        </ActionButton>
                        <ActionButton
                          endpoint={`/api/estimates/${e.id}/decision`}
                          body={{ approved: false }}
                          confirm
                        >
                          Reject
                        </ActionButton>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
          {work.invoice && (
            <div className="panel">
              <h3>Invoice {work.invoice.number}</h3>
              <p className="money-total">{money(work.invoice.total)}</p>
              <a
                href={`/api/invoices/${work.invoice.id}/pdf`}
                className="button button-primary"
              >
                Download invoice PDF
              </a>
            </div>
          )}
        </div>
        <aside>
          <div className="panel">
            <h2 style={{ fontSize: 17, marginBottom: 25 }}>
              Your service journey
            </h2>
            <ol className="timeline">
              {work.history.map((h) => (
                <li key={h.id}>
                  <strong>{label(h.status)}</strong>
                  <p>{h.note}</p>
                  <small>{date(h.createdAt)}</small>
                </li>
              ))}
            </ol>
          </div>
          <div className="panel">
            <h3>Vehicle details</h3>
            <p className="muted">
              {work.appointment.vehicle.year} · {work.appointment.vehicle.fuel}
              <br />
              {work.appointment.vehicle.transmission}
              <br />
              {work.appointment.vehicle.mileage.toLocaleString()} km
            </p>
            <p className="code-note">Owner: {work.appointment.customer.name}</p>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
