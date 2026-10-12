"use client";
import Link from "next/link";
import { Shell } from "./shell";
import { Badge, Empty } from "./workspace";
import { date, money } from "@/lib/utils";
import type {
  WorkspaceData,
  VehicleDetailData,
} from "@/server/services/queries";
export function VehicleDetail({
  data,
  vehicle,
  base,
}: {
  data: WorkspaceData;
  vehicle: VehicleDetailData;
  base: string;
}) {
  return (
    <Shell data={data} base={base}>
      <Link className="text-link muted" href={`${base}/vehicles`}>
        ← All vehicles
      </Link>
      <div className="detail-header" style={{ marginTop: 20 }}>
        <div>
          <h1>
            {vehicle.make} {vehicle.model}
          </h1>
          <p>
            {vehicle.registration} · {vehicle.year} · {vehicle.fuel} ·{" "}
            {vehicle.transmission}
          </p>
        </div>
        <strong>{vehicle.mileage.toLocaleString()} km</strong>
      </div>
      <div className="dashboard-grid">
        <div>
          <div className="panel">
            <h2 style={{ fontSize: 18 }}>Service history</h2>
            {vehicle.maintenance.length ? (
              vehicle.maintenance.map((m) => (
                <div className="list-row" key={m.id}>
                  <div>
                    <h3>{m.summary}</h3>
                    <p>
                      {m.workOrder.center.name} · {date(m.createdAt)} ·{" "}
                      {m.mileage.toLocaleString()} km
                    </p>
                  </div>
                  <Link
                    className="teal"
                    href={`${base}/${base === "/manager" ? "work-orders" : "repairs"}/${m.workOrderId}`}
                  >
                    {m.workOrder.invoice
                      ? money(m.workOrder.invoice.total)
                      : "View repair"}{" "}
                    ↗
                  </Link>
                </div>
              ))
            ) : (
              <Empty title="No completed service records" />
            )}
          </div>
          <div className="panel">
            <h2 style={{ fontSize: 18 }}>Appointment history</h2>
            {vehicle.appointments.map((a) => (
              <div className="list-row" key={a.id}>
                <div>
                  <h3>{a.service.name}</h3>
                  <p>
                    {a.center.name} · {date(a.startsAt)}
                  </p>
                </div>
                <Badge value={a.status} />
              </div>
            ))}
            {!vehicle.appointments.length && (
              <Empty title="No appointments yet" />
            )}
          </div>
        </div>
        <div className="panel">
          <h2 style={{ fontSize: 18 }}>Mileage readings</h2>
          <p className="code-note">
            Latest 50 readings. Workshop corrections retain their explanation.
          </p>
          {vehicle.mileageRecords.map((m) => (
            <div className="list-row" key={m.id}>
              <div>
                <h3>{m.mileage.toLocaleString()} km</h3>
                <p>{m.note}</p>
                <small className="muted">{date(m.createdAt)}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
