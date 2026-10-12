"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CarFront,
  CalendarDays,
  Wrench,
  FileText,
  ArrowUpRight,
  ArrowRight,
  Bell,
  ClipboardList,
  Building2,
  Users,
  CircleCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import type { WorkspaceData } from "@/server/services/queries";
import { money, date, label } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Shell } from "./shell";
import { ActionButton, ActionForm, type Field } from "./forms";
import { BookingForm } from "./booking-form";
import { Button } from "./ui/button";
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>{label(value)}</span>
  );
}
export function Empty({
  title = "A clear road ahead",
  text = "Nothing here yet. Your records will appear as you start using FixFlow.",
  children,
}: {
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <ClipboardList size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
const vehicleFields: Field[] = [
  { name: "registration", label: "Registration number" },
  { name: "make", label: "Make" },
  { name: "model", label: "Model" },
  {
    name: "year",
    label: "Manufacturing year",
    type: "number",
    min: 1900,
    max: new Date().getFullYear() + 1,
  },
  {
    name: "category",
    label: "Vehicle category",
    options: options([
      "Car",
      "SUV",
      "Van",
      "Motorcycle",
      "Three-wheeler",
      "Pickup",
      "Other",
    ]),
  },
  {
    name: "fuel",
    label: "Fuel type",
    options: options(["Petrol", "Diesel", "Hybrid", "Electric", "Other"]),
  },
  {
    name: "transmission",
    label: "Transmission",
    options: options(["Automatic", "Manual", "Other"]),
  },
  { name: "mileage", label: "Current mileage (km)", type: "number", min: 0 },
  { name: "color", label: "Color", required: false },
  { name: "vin", label: "VIN / chassis number", required: false },
  { name: "engineNumber", label: "Engine number", required: false },
  { name: "notes", label: "Notes", type: "textarea", required: false },
];
const centerFields: Field[] = [
  { name: "name", label: "Center name" },
  { name: "address", label: "Address" },
  { name: "district", label: "District" },
  { name: "province", label: "Province", value: "Western" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email", type: "email" },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
  },
  { name: "timezone", label: "Timezone", value: "Asia/Colombo" },
  {
    name: "openHour",
    label: "Opening hour (0–23)",
    type: "number",
    value: 8,
    min: 0,
    max: 23,
  },
  {
    name: "closeHour",
    label: "Closing hour (1–24)",
    type: "number",
    value: 17,
    min: 1,
    max: 24,
  },
  {
    name: "capacity",
    label: "Concurrent appointment capacity",
    type: "number",
    min: 1,
    value: 3,
  },
  {
    name: "openDays",
    label: "Open weekdays (0=Sunday, comma-separated)",
    value: "1,2,3,4,5,6",
  },
  {
    name: "closures",
    label: "Closures (YYYY-MM-DD, comma-separated)",
    required: false,
  },
];
const centerTransform = (d: Record<string, unknown>) => ({
  ...d,
  openDays: String(d.openDays).split(",").map(Number),
  closures: String(d.closures ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});
export function Workspace({
  data,
  base,
  section = "",
}: {
  data: WorkspaceData;
  base: string;
  section?: string;
}) {
  const router = useRouter();
  const isManager = base === "/manager";
  const isCustomer = base === "/dashboard";
  const isAdmin = base === "/admin";
  const centerOptions = data.centers
    .filter((c) => isAdmin || data.managerIds.includes(c.id))
    .map((c) => ({ value: c.id, label: c.name }));
  const centerField: Field = {
    name: "centerId",
    label: "Service center",
    options: centerOptions,
    value: centerOptions[0]?.value,
  };
  const titles: Record<string, string> = {
    vehicles: isCustomer ? "My vehicles" : "Customer vehicles",
    appointments: "Appointments",
    repairs: "Repair tracking",
    "work-orders": "Work orders",
    jobs: "Assigned jobs",
    estimates: "Repair estimates",
    invoices: "Invoices & payments",
    inventory: "Parts & inventory",
    technicians: "Your technicians",
    services: "Service catalog",
    notifications: "Your notifications",
    history: "Service history",
    maintenance: "Maintenance reminders",
    profile: "Your profile & settings",
    settings: "Center settings",
    reports: "Workshop reports",
    "service-centers": "Service centers",
    users: "Users & access",
    "audit-logs": "Platform activity",
  };
  const jobHref = (id: string) =>
    `${base}/${isCustomer ? "repairs" : isManager ? "work-orders" : "jobs"}/${id}`;
  const addVehicle = (
    <ActionForm
      title="Add a vehicle"
      endpoint="/api/vehicles"
      fields={vehicleFields}
    />
  );
  const vehicleCards = (limit?: number) => (
    <div className="cards-grid">
      {data.vehicles
        .filter((v) => !limit || !v.archived)
        .slice(0, limit)
        .map((v) => (
          <article className="vehicle-card" key={v.id}>
            <div className="vehicle-card-icon">
              <CarFront size={55} strokeWidth={1.3} />
            </div>
            <h3>
              {v.make} {v.model}
            </h3>
            <p>
              {v.year} · {v.fuel} · {v.transmission}
            </p>
            <div className="vehicle-card-footer">
              <strong>{v.registration}</strong>
              <span>{v.mileage.toLocaleString()} km</span>
            </div>
            <Link
              className="text-link teal"
              style={{ marginTop: 12 }}
              href={`${base}/vehicles/${v.id}`}
            >
              Mileage & service records ↗
            </Link>
            {!limit && (
              <div className="inline-actions" style={{ marginTop: 15 }}>
                {v.archived ? (
                  <Badge value="ARCHIVED" />
                ) : isCustomer ? (
                  <>
                    <ActionForm
                      title="Edit vehicle"
                      trigger="Edit details"
                      endpoint={`/api/vehicles/${v.id}`}
                      method="PATCH"
                      fields={vehicleFields.map((f) => ({
                        ...f,
                        value: v[f.name as keyof typeof v] as string | number,
                      }))}
                    />
                    <ActionButton
                      endpoint={`/api/vehicles/${v.id}`}
                      method="DELETE"
                      confirm
                    >
                      Archive
                    </ActionButton>
                  </>
                ) : (
                  <ActionForm
                    title="Correct mileage"
                    endpoint={`/api/mileage-correction/${v.id}`}
                    fields={[
                      {
                        name: "mileage",
                        label: "Corrected mileage",
                        type: "number",
                        min: 0,
                      },
                      {
                        name: "reason",
                        label: "Documented correction reason",
                        type: "textarea",
                      },
                    ]}
                  />
                )}
              </div>
            )}
          </article>
        ))}
    </div>
  );
  const jobList = (limit?: number) =>
    data.jobs.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vehicle / service</th>
              <th>Status</th>
              <th>Technician</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.jobs.slice(0, limit).map((j) => (
              <tr key={j.id}>
                <td>
                  <strong>{j.appointment.vehicle.registration}</strong>
                  <small>{j.appointment.service.name}</small>
                </td>
                <td>
                  <Badge value={j.status} />
                </td>
                <td>{j.technician?.name ?? "Unassigned"}</td>
                <td>
                  <Link
                    className="teal"
                    href={jobHref(j.id)}
                    aria-label={`View repair ${j.appointment.vehicle.registration}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No repair jobs yet"
        text="Your active repairs and their latest progress will appear here."
      />
    );
  const bookingList = (limit?: number) =>
    data.appointments.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Service / center</th>
              <th>Appointment</th>
              <th>Status</th>
              {!limit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.appointments.slice(0, limit).map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.vehicle.registration}</strong>
                  <small>
                    {a.vehicle.make} {a.vehicle.model}
                  </small>
                </td>
                <td>
                  <strong>{a.service.name}</strong>
                  <small>{a.center.name}</small>
                </td>
                <td>{date(a.startsAt)}</td>
                <td>
                  <Badge value={a.status} />
                </td>
                {!limit && (
                  <td>
                    <div className="inline-actions">
                      {isCustomer &&
                        ["PENDING", "CONFIRMED"].includes(a.status) &&
                        new Date(a.startsAt) > new Date() && (
                          <>
                            <BookingForm data={data} appointmentId={a.id} />
                            <ActionButton
                              endpoint={`/api/appointments/${a.id}`}
                              method="PATCH"
                              body={{ status: "CANCELLED" }}
                              confirm
                            >
                              Cancel
                            </ActionButton>
                          </>
                        )}
                      {isManager && a.status === "PENDING" && (
                        <>
                          <ActionButton
                            endpoint={`/api/appointments/${a.id}`}
                            method="PATCH"
                            body={{ status: "CONFIRMED" }}
                          >
                            Confirm
                          </ActionButton>
                          <ActionButton
                            endpoint={`/api/appointments/${a.id}`}
                            method="PATCH"
                            body={{ status: "REJECTED" }}
                            confirm
                          >
                            Reject
                          </ActionButton>
                        </>
                      )}
                      {isManager && a.status === "CONFIRMED" && (
                        <>
                          <BookingForm data={data} appointmentId={a.id} />
                          <ActionButton
                            endpoint={`/api/appointments/${a.id}`}
                            method="PATCH"
                            body={{ status: "CHECKED_IN" }}
                          >
                            Check in
                          </ActionButton>
                          <ActionButton
                            endpoint={`/api/appointments/${a.id}`}
                            method="PATCH"
                            body={{ status: "NO_SHOW" }}
                            confirm
                          >
                            No show
                          </ActionButton>
                        </>
                      )}
                      {a.workOrder && (
                        <Link className="teal" href={jobHref(a.workOrder.id)}>
                          View repair →
                        </Link>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Your next service starts here"
        text="Book an appointment and we’ll keep all the details in one place."
      >
        {isCustomer && <BookingForm data={data} />}
      </Empty>
    );
  const staffForm = (
    <ActionForm
      title={isAdmin ? "Create manager account" : "Add technician"}
      endpoint="/api/staff"
      extra={{ role: isAdmin ? "MANAGER" : "TECHNICIAN" }}
      fields={[
        centerField,
        { name: "name", label: "Full name" },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Phone", required: false },
        {
          name: "password",
          label: "Initial password (12+ characters)",
          type: "password",
          help: "Share securely and ask the user to change it.",
        },
        { name: "specializations", label: "Specializations", required: false },
      ]}
    />
  );
  const overview = (
    <>
      <div className="stats-grid">
        {(data.platform
          ? [
              ["Platform users", data.platform.users, Users],
              ["Service centers", data.platform.centers, Building2],
              ["Appointments", data.platform.appointments, CalendarDays],
              ["Work orders", data.platform.jobs, Wrench],
            ]
          : [
              [
                isCustomer ? "My vehicles" : "Customer vehicles",
                data.stats.vehicles,
                CarFront,
              ],
              ["Upcoming appointments", data.stats.appointments, CalendarDays],
              ["Active repairs", data.stats.jobs, Wrench],
              ["Awaiting approval", data.stats.estimates, FileText],
            ]
        ).map(([name, value, Icon]) => {
          const I = Icon as typeof CarFront;
          return (
            <div className="stat-card" key={String(name)}>
              <div className="stat-label">
                {String(name)}
                <I />
              </div>
              <div className="stat-value">{String(value).padStart(2, "0")}</div>
              <div className="stat-foot">From your current saved records</div>
            </div>
          );
        })}
      </div>
      {isAdmin ? (
        <div className="panel">
          <h2>Keep your platform moving.</h2>
          <p className="muted">
            Create centers, provision managers, and review account access.
          </p>
          <div className="inline-actions">
            <Link
              className="button button-primary"
              href="/admin/service-centers"
            >
              Manage centers
            </Link>
            {staffForm}
          </div>
        </div>
      ) : base === "/technician" ? (
        <div className="panel">
          <div className="panel-heading">
            <h2>Your assigned work</h2>
            <Link href="/technician/jobs">View all jobs ↗</Link>
          </div>
          {jobList(10)}
        </div>
      ) : (
        <div className="dashboard-grid">
          <div>
            <div className="panel">
              <div className="panel-heading">
                <h2>{isCustomer ? "Your vehicles" : "Workshop activity"}</h2>
                <Link
                  href={`${base}/${isCustomer ? "vehicles" : "work-orders"}`}
                >
                  View all <span aria-hidden>↗</span>
                </Link>
              </div>
              {isCustomer ? (
                data.vehicles.length ? (
                  vehicleCards(2)
                ) : (
                  <Empty
                    title="Welcome to your garage"
                    text="Add your first vehicle to start organizing its care."
                  >
                    {addVehicle}
                  </Empty>
                )
              ) : (
                jobList(5)
              )}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>
                  {isCustomer ? "Recent appointments" : "Appointment requests"}
                </h2>
                <Link href={`${base}/appointments`}>View all ↗</Link>
              </div>
              {bookingList(4)}
            </div>
          </div>
          <div>
            <div className="welcome-banner">
              <CarFront strokeWidth={1} />
              <h2>
                A little care.
                <br />A longer journey.
              </h2>
              <p>
                {isCustomer
                  ? "Keep your service records up to date. Your next maintenance reminder starts with your latest mileage."
                  : "Keep your workshop in sync. Check in appointments and assign technicians to start the day."}
              </p>
              <Link
                href={`${base}/${isCustomer ? "maintenance" : "work-orders"}`}
              >
                {isCustomer ? "View maintenance" : "Open work orders"}
                <ArrowRight size={13} />
              </Link>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Latest updates</h2>
                <Link href={`${base}/notifications`}>View all ↗</Link>
              </div>
              {data.notifications.length ? (
                data.notifications.slice(0, 4).map((n) => (
                  <Link href={n.href} className="list-row" key={n.id}>
                    <span className="list-icon">
                      <Bell />
                    </span>
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.message}</p>
                      <small className="muted">{date(n.createdAt)}</small>
                    </div>
                  </Link>
                ))
              ) : (
                <Empty
                  title="You’re all caught up"
                  text="Updates from your workshop will appear here."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
  let body: React.ReactNode = overview;
  if (section === "vehicles")
    body = data.vehicles.length ? (
      vehicleCards()
    ) : (
      <Empty title="No vehicles registered yet">
        {isCustomer && addVehicle}
      </Empty>
    );
  if (section === "appointments")
    body = <div className="panel">{bookingList()}</div>;
  if (["repairs", "work-orders", "jobs"].includes(section))
    body = <div className="panel">{jobList()}</div>;
  if (section === "estimates")
    body = data.estimates.length ? (
      <div className="form-stack">
        {data.estimates.map((e) => (
          <div className="panel" key={e.id}>
            <div className="panel-heading">
              <h2>
                {e.workOrder.appointment.vehicle.registration} · Version{" "}
                {e.version}
              </h2>
              <Badge value={e.status} />
            </div>
            <p className="muted">Expires {date(e.expiresAt)}</p>
            {e.items.map((i) => (
              <div className="list-row" key={i.id}>
                <div>
                  <strong>{i.description}</strong>
                  <p>
                    {i.kind} · {i.quantity} × {money(i.unitPrice)}
                  </p>
                </div>
                <span>{money(i.quantity * i.unitPrice)}</span>
              </div>
            ))}
            <div className="list-row">
              <div>
                Discount {money(e.discount)} · Tax {money(e.tax)}
              </div>
              <strong className="money-total">{money(e.total)}</strong>
            </div>
            <div className="inline-actions">
              <Link
                className="button button-outline button-sm"
                href={jobHref(e.workOrderId)}
              >
                View repair
              </Link>
              {isCustomer &&
                e.status === "SENT" &&
                new Date(e.expiresAt) > new Date() && (
                  <>
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
                      Reject estimate
                    </ActionButton>
                  </>
                )}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <Empty title="No estimates to review" />
    );
  if (section === "invoices")
    body = data.invoices.length ? (
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice / vehicle</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((i) => {
                const balance =
                  i.total - i.payments.reduce((s, p) => s + p.amount, 0);
                return (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.number}</strong>
                      <small>
                        {i.workOrder.appointment.vehicle.registration}
                      </small>
                    </td>
                    <td>{money(i.total)}</td>
                    <td>{money(balance)}</td>
                    <td>
                      <Badge
                        value={
                          i.voided
                            ? "VOID"
                            : balance === 0
                              ? "PAID"
                              : balance === i.total
                                ? "ISSUED"
                                : "PARTIALLY_PAID"
                        }
                      />
                    </td>
                    <td>
                      <div className="inline-actions">
                        <a
                          className="button button-outline button-sm"
                          href={`/api/invoices/${i.id}/pdf`}
                        >
                          Download PDF
                        </a>
                        {isManager && balance > 0 && !i.voided && (
                          <ActionForm
                            title="Record manual payment"
                            endpoint={`/api/invoices/${i.id}/payments`}
                            fields={[
                              {
                                name: "amount",
                                label: "Amount (LKR)",
                                type: "money",
                                min: 1,
                                max: balance,
                                help: `Outstanding: ${money(balance)}`,
                              },
                              {
                                name: "method",
                                label: "Payment method",
                                options: options([
                                  "CASH",
                                  "BANK_TRANSFER",
                                  "OTHER_MANUAL",
                                ]),
                              },
                              {
                                name: "reference",
                                label: "Receipt / transfer reference",
                              },
                            ]}
                            transform={(d) => ({
                              ...d,
                              requestKey: crypto.randomUUID(),
                            })}
                          />
                        )}
                        {isManager && !i.payments.length && !i.voided && (
                          <ActionForm
                            title="Void unpaid invoice"
                            endpoint={`/api/invoices/${i.id}/void`}
                            fields={[
                              {
                                name: "reason",
                                label: "Reason",
                                type: "textarea",
                              },
                            ]}
                          />
                        )}
                      </div>
                      {i.payments.map((p) => (
                        <p key={p.id} className="code-note">
                          {date(p.createdAt)} · {money(p.amount)} ·{" "}
                          {label(p.method)} · {p.reference}
                        </p>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <Empty
        title="No invoices yet"
        text="Your workshop will issue an invoice after the final quality check."
      />
    );
  if (section === "inventory")
    body = (
      <div className="panel">
        {data.inventory.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Stock</th>
                  <th>Unit price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>{p.sku}</small>
                    </td>
                    <td>
                      {p.quantity}{" "}
                      {p.quantity <= p.reorderLevel && (
                        <Badge value="LOW_STOCK" />
                      )}
                    </td>
                    <td>{money(p.price)}</td>
                    <td>
                      <ActionForm
                        title="Edit spare part"
                        endpoint={`/api/inventory/${p.id}`}
                        method="PATCH"
                        fields={[
                          { name: "sku", label: "SKU", value: p.sku },
                          { name: "name", label: "Part name", value: p.name },
                          {
                            name: "cost",
                            label: "Unit cost (LKR)",
                            type: "money",
                            value: p.cost,
                          },
                          {
                            name: "price",
                            label: "Selling price (LKR)",
                            type: "money",
                            value: p.price,
                          },
                          {
                            name: "reorderLevel",
                            label: "Reorder level",
                            type: "number",
                            min: 0,
                            value: p.reorderLevel,
                          },
                          {
                            name: "supplier",
                            label: "Supplier",
                            value: p.supplier,
                            required: false,
                          },
                          {
                            name: "active",
                            label: "Available for use",
                            type: "checkbox",
                            value: p.active,
                          },
                        ]}
                      />
                      <ActionForm
                        title="Adjust inventory"
                        endpoint={`/api/inventory/${p.id}/movement`}
                        fields={[
                          {
                            name: "delta",
                            label: "Quantity change (+ received / − removed)",
                            type: "number",
                          },
                          { name: "reason", label: "Reason" },
                        ]}
                        transform={(d) => ({
                          ...d,
                          requestKey: crypto.randomUUID(),
                        })}
                      />
                      <details>
                        <summary className="code-note">
                          Recent movements
                        </summary>
                        {p.movements.map((m) => (
                          <p className="code-note" key={m.id}>
                            {m.delta > 0 ? "+" : ""}
                            {m.delta} · {m.reason} · {date(m.createdAt)}
                          </p>
                        ))}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Your inventory is empty"
            text="Add parts, then record a stock receipt to make them available."
          />
        )}
      </div>
    );
  if (section === "technicians")
    body = (
      <div className="cards-grid">
        {data.technicians.length ? (
          data.technicians.map((t) => (
            <article className="panel" key={t.id}>
              <div className="avatar">{t.user.name[0]}</div>
              <h3 style={{ marginTop: 15 }}>{t.user.name}</h3>
              <p className="muted">{t.user.email}</p>
              <p>{t.specializations || "General maintenance"}</p>
              <p>{t.user._count.assignments} active assignments</p>
              <Badge value={t.active ? "ACTIVE" : "INACTIVE"} />
              <div style={{ marginTop: 15 }}>
                <ActionForm
                  title="Edit technician"
                  endpoint={`/api/staff/${t.id}`}
                  method="PATCH"
                  fields={[
                    {
                      name: "specializations",
                      label: "Specializations",
                      value: t.specializations,
                      required: false,
                    },
                    {
                      name: "active",
                      label: "Active membership",
                      type: "checkbox",
                      value: t.active,
                    },
                  ]}
                />
              </div>
            </article>
          ))
        ) : (
          <Empty title="Build your workshop team">{staffForm}</Empty>
        )}
      </div>
    );
  const serviceFields: Field[] = [
    centerField,
    { name: "name", label: "Service name" },
    { name: "category", label: "Category" },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      required: false,
    },
    {
      name: "duration",
      label: "Duration (minutes, multiples of 30)",
      type: "number",
      min: 30,
      value: 60,
    },
    {
      name: "startingPrice",
      label: "Starting price (LKR)",
      type: "money",
      min: 0,
    },
    {
      name: "intervalKm",
      label: "Maintenance interval (km)",
      type: "number",
      required: false,
    },
    {
      name: "intervalMonths",
      label: "Maintenance interval (months)",
      type: "number",
      required: false,
    },
    { name: "active", label: "Active service", type: "checkbox", value: true },
  ];
  if (section === "services")
    body = (
      <div className="panel">
        <div className="inline-actions" style={{ marginBottom: 20 }}>
          <ActionForm
            title="Add service"
            endpoint="/api/services"
            fields={serviceFields}
          />
        </div>
        {data.services.length ? (
          data.services.map((s) => (
            <div className="list-row" key={s.id}>
              <span className="list-icon">
                <Wrench />
              </span>
              <div>
                <h3>{s.name}</h3>
                <p>
                  {s.center.name} · {s.duration} min · From{" "}
                  {money(s.startingPrice)}
                </p>
              </div>
              <Badge value={s.active ? "ACTIVE" : "INACTIVE"} />
              <ActionForm
                title="Edit service"
                endpoint={`/api/services/${s.id}`}
                method="PATCH"
                fields={serviceFields.map((f) => ({
                  ...f,
                  value: s[f.name as keyof typeof s] as
                    string | number | boolean,
                }))}
              />
            </div>
          ))
        ) : (
          <Empty title="Add your workshop’s services" />
        )}
      </div>
    );
  if (section === "notifications")
    body = (
      <div className="panel">
        <div className="panel-heading">
          <h2>{data.stats.unread} unread updates</h2>
          <ActionButton endpoint="/api/notifications/all" method="PATCH">
            Mark all read
          </ActionButton>
        </div>
        {data.notifications.length ? (
          data.notifications.map((n) => (
            <div className="list-row" key={n.id}>
              <span className="list-icon">
                <Bell />
              </span>
              <div>
                <Link href={n.href}>
                  <h3>{n.title}</h3>
                </Link>
                <p>{n.message}</p>
                <small className="muted">{date(n.createdAt)}</small>
              </div>
              {!n.read && (
                <ActionButton
                  endpoint={`/api/notifications/${n.id}`}
                  method="PATCH"
                >
                  Mark read
                </ActionButton>
              )}
            </div>
          ))
        ) : (
          <Empty title="You’re all caught up" />
        )}
      </div>
    );
  if (section === "history")
    body = data.history.length ? (
      <div className="panel">
        {data.history.map((h) => (
          <div className="list-row" key={h.id}>
            <span className="list-icon">
              <CircleCheck />
            </span>
            <div>
              <h3>
                {h.summary} · {h.vehicle.registration}
              </h3>
              <p>
                {h.workOrder.center.name} · {date(h.createdAt)} ·{" "}
                {h.mileage.toLocaleString()} km
              </p>
            </div>
            <Link className="teal" href={jobHref(h.workOrderId)}>
              View record ↗
            </Link>
          </div>
        ))}
      </div>
    ) : (
      <Empty
        title="A service history worth keeping"
        text="Completed services will appear here automatically."
      />
    );
  if (section === "maintenance")
    body = data.reminders.length ? (
      <div className="cards-grid">
        {data.reminders.map((r) => (
          <article className="panel" key={r.id}>
            <Badge value={r.state} />
            <h3 style={{ marginTop: 15 }}>{r.title}</h3>
            <p>{r.vehicle.registration}</p>
            <p className="muted">
              {r.dueMileage ? `Due at ${r.dueMileage.toLocaleString()} km` : ""}
              <br />
              {r.dueDate ? `Time target: ${date(r.dueDate)}` : ""}
            </p>
            <p className="code-note">{r.explanation}</p>
            {!r.dismissed && (
              <ActionButton
                endpoint={`/api/reminders/${r.id}`}
                method="PATCH"
                confirm
              >
                Dismiss reminder
              </ActionButton>
            )}
          </article>
        ))}
      </div>
    ) : (
      <Empty
        title="Your maintenance plan starts here"
        text="Complete a service with a configured maintenance interval to receive reminders."
      />
    );
  if (section === "profile")
    body = (
      <div className="panel" style={{ maxWidth: 650 }}>
        <h2>Account details</h2>
        <p className="muted">
          {data.user.email} · {label(data.user.role)}
        </p>
        <ActionForm
          title="Edit profile"
          endpoint="/api/profile"
          method="PATCH"
          fields={[
            { name: "name", label: "Full name", value: data.user.name },
            {
              name: "phone",
              label: "Phone",
              value: data.user.phone,
              required: false,
            },
            {
              name: "emailNotifications",
              label: "Email notification preference",
              type: "checkbox",
              value: data.user.emailNotifications,
            },
          ]}
        />
        <h3 style={{ marginTop: 30 }}>Change password</h3>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const result = await authClient.changePassword({
              currentPassword: String(form.get("current")),
              newPassword: String(form.get("next")),
              revokeOtherSessions: true,
            });
            if (result.error) toast.error(result.error.message);
            else {
              toast.success("Password changed. Other sessions revoked.");
              router.refresh();
            }
          }}
        >
          <label className="field">
            Current password
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            New password
            <input
              name="next"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <Button type="submit">Update password</Button>
        </form>
      </div>
    );
  if (section === "settings")
    body = (
      <div className="form-stack">
        {data.centers
          .filter((c) => data.managerIds.includes(c.id))
          .map((c) => (
            <div className="panel" key={c.id}>
              <h2>{c.name}</h2>
              <p className="muted">
                {c.address} · Capacity {c.capacity} · {c.timezone}
              </p>
              <ActionForm
                title="Update center settings"
                endpoint={`/api/centers/${c.id}`}
                method="PATCH"
                fields={centerFields.map((f) => ({
                  ...f,
                  value:
                    f.name === "openDays"
                      ? c.openDays.join(",")
                      : f.name === "closures"
                        ? c.closures.join(",")
                        : (c[f.name as keyof typeof c] as string | number),
                }))}
                transform={centerTransform}
              />
            </div>
          ))}
      </div>
    );
  if (section === "reports")
    body = (
      <div className="dashboard-grid">
        <div className="panel">
          <h3>Revenue by month</h3>
          <p className="code-note">Last 12 months · recorded payments in LKR</p>
          <a
            className="button button-outline button-sm"
            href="/api/reports/export"
            download
          >
            Download monthly CSV
          </a>
          {data.monthlyRevenue.length ? (
            <div className="chart-container">
              <ResponsiveContainer>
                <BarChart data={data.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#128f83" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No revenue recorded" />
          )}
        </div>
        <div className="panel">
          <h3>Appointments by month</h3>
          <p className="code-note">Last 12 months · all booking statuses</p>
          {data.monthlyAppointments.length ? (
            <div className="chart-container">
              <ResponsiveContainer>
                <BarChart data={data.monthlyAppointments}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#456b86" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No appointments recorded" />
          )}
          <p>
            Outstanding invoice balance:{" "}
            <strong>{money(data.outstanding)}</strong>
          </p>
        </div>
        <div className="panel">
          <h3>Recorded payments by method</h3>
          <p className="code-note">
            All-time received payments, LKR. Voided invoices excluded.
          </p>
          {data.revenue.length ? (
            <div className="chart-container">
              <ResponsiveContainer>
                <BarChart
                  data={data.revenue.map((r) => ({
                    name: label(r.method),
                    amount: (r._sum.amount ?? 0) / 100,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#128f83" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No recorded payments yet" />
          )}
        </div>
        <div className="panel">
          <h3>Repair status distribution</h3>
          {data.distribution.map((s) => (
            <div className="list-row" key={s.status}>
              <div>
                <Badge value={s.status} />
              </div>
              <strong>{s._count}</strong>
            </div>
          ))}
          {!data.distribution.length && <Empty title="No repair records yet" />}
        </div>
        <div className="panel" style={{ gridColumn: "1/-1" }}>
          <h3>Recent workshop activity</h3>
          {data.audit.map((a) => (
            <div className="list-row" key={a.id}>
              <div>
                <h3>{label(a.action)}</h3>
                <p>
                  {a.actor.name} · {date(a.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (section === "service-centers")
    body = (
      <>
        <div className="inline-actions" style={{ marginBottom: 25 }}>
          <ActionForm
            title="Create service center"
            endpoint="/api/centers"
            fields={centerFields}
            transform={centerTransform}
          />
          {staffForm}
        </div>
        <div className="cards-grid">
          {data.centers.map((c) => (
            <article className="center-card" key={c.id}>
              <h2>{c.name}</h2>
              <p>
                {c.address} · {c.district}
              </p>
              <Badge
                value={
                  c.active
                    ? "ACTIVE"
                    : c.approvedAt
                      ? "SUSPENDED"
                      : "PENDING_APPROVAL"
                }
              />
              <div style={{ marginTop: 15 }}>
                <ActionButton
                  endpoint={`/api/centers/${c.id}`}
                  method="PATCH"
                  body={{ active: !c.active }}
                  confirm
                >
                  {c.active
                    ? "Suspend"
                    : c.approvedAt
                      ? "Activate"
                      : "Approve center"}
                </ActionButton>
              </div>
            </article>
          ))}
        </div>
      </>
    );
  if (section === "users")
    body = (
      <div className="panel">
        <div className="panel-heading">
          <h2>Platform accounts</h2>
          {staffForm}
        </div>
        {data.users.map((u) => (
          <div className="list-row" key={u.id}>
            <div>
              <h3>{u.name}</h3>
              <p>{u.email}</p>
            </div>
            <Badge value={u.role} />
            <Badge value={u.active ? "ACTIVE" : "INACTIVE"} />
            {u.id !== data.user.id && (
              <ActionButton
                endpoint={`/api/users/${u.id}`}
                method="PATCH"
                body={{ active: !u.active }}
                confirm
              >
                {u.active ? "Deactivate" : "Activate"}
              </ActionButton>
            )}
          </div>
        ))}
      </div>
    );
  if (section === "audit-logs")
    body = (
      <div className="panel">
        {data.audit.map((a) => (
          <div className="list-row" key={a.id}>
            <div>
              <h3>{label(a.action)}</h3>
              <p>
                {a.actor.name} · {a.resourceId}
              </p>
            </div>
            <small>{date(a.createdAt)}</small>
          </div>
        ))}
      </div>
    );
  return (
    <Shell data={data} base={base}>
      <div className="page-heading">
        <div>
          <h1>
            {section
              ? titles[section]
              : `Welcome back, ${data.user.name.split(" ")[0]}.`}
          </h1>
          <p>
            {section
              ? "Everything you need, organized in one place."
              : isCustomer
                ? "Here’s what’s happening with your vehicles today."
                : "A clear view of the work that keeps you moving."}
          </p>
        </div>
        <div className="inline-actions">
          {isCustomer && ["", "appointments"].includes(section) && (
            <BookingForm data={data} />
          )}
          {isCustomer && section === "vehicles" && addVehicle}
          {section === "technicians" && staffForm}
          {section === "inventory" && (
            <ActionForm
              title="Add spare part"
              endpoint="/api/inventory"
              fields={[
                centerField,
                { name: "sku", label: "SKU" },
                { name: "name", label: "Part name" },
                {
                  name: "cost",
                  label: "Unit cost (LKR)",
                  type: "money",
                  min: 0,
                },
                {
                  name: "price",
                  label: "Selling price (LKR)",
                  type: "money",
                  min: 0,
                },
                {
                  name: "reorderLevel",
                  label: "Reorder level",
                  type: "number",
                  min: 0,
                  value: 5,
                },
                { name: "supplier", label: "Supplier", required: false },
              ]}
            />
          )}
        </div>
      </div>
      {["vehicles", "inventory"].includes(section) && (
        <div className="toolbar">
          <form method="GET">
            <input
              className="search-input"
              name="q"
              placeholder={
                section === "vehicles"
                  ? "Search registration or make…"
                  : "Search part name…"
              }
              aria-label="Search records"
            />
            <Button variant="outline" type="submit" size="sm">
              Search
            </Button>
          </form>
        </div>
      )}
      {body}
      {section && !["settings", "profile"].includes(section) && (
        <div className="pagination">
          {data.page > 1 && (
            <Link
              className="button button-outline button-sm"
              href={`?page=${data.page - 1}`}
            >
              Previous
            </Link>
          )}
          <span>Page {data.page} · up to 20 records</span>
          <Link
            className="button button-outline button-sm"
            href={`?page=${data.page + 1}`}
          >
            Next
          </Link>
        </div>
      )}
    </Shell>
  );
}
