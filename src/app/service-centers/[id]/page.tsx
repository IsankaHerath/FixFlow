import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Brand } from "@/components/brand";
import { money } from "@/lib/utils";
export const dynamic = "force-dynamic";
export default async function CenterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const center = await db.serviceCenter.findFirst({
    where: { id, active: true },
    include: { services: { where: { active: true }, take: 100 } },
  });
  if (!center) notFound();
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return (
    <>
      <header className="public-header">
        <Brand />
        <Link href="/service-centers">All centers</Link>
      </header>
      <main id="main" className="readable">
        <span className="eyebrow">
          {center.district} / {center.province}
        </span>
        <h1>{center.name}</h1>
        <p>{center.description}</p>
        <div className="panel">
          <p>
            {center.address}
            <br />
            {center.phone} · {center.email}
          </p>
          <p>
            {center.openDays.map((d) => days[d]).join(", ")}
            <br />
            {center.openHour}:00–{center.closeHour}:00 · {center.timezone}
          </p>
        </div>
        <h2>Available services</h2>
        {center.services.map((s) => (
          <div className="panel" key={s.id}>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <p>
              {s.duration} minutes · From {money(s.startingPrice)}
            </p>
            <small className="muted">
              Starting price is indicative. Final work requires an approved
              estimate.
            </small>
          </div>
        ))}
        <Link href="/dashboard/appointments" className="button button-primary">
          Book a service
        </Link>
      </main>
    </>
  );
}
