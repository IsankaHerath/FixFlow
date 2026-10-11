import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";
import { db } from "@/lib/db";
import { money } from "@/lib/utils";
export const dynamic = "force-dynamic";
export default async function PublicPage({
  params,
}: {
  params: Promise<{ publicPage: string }>;
}) {
  const { publicPage } = await params;
  if (
    ["login", "register", "forgot-password", "reset-password"].includes(
      publicPage,
    )
  )
    return (
      <Suspense fallback={<div className="loading">Loading…</div>}>
        <AuthForm mode={publicPage} />
      </Suspense>
    );
  const titles: Record<string, string> = {
    "service-centers": "Find your next service center.",
    contact: "Let’s keep things moving.",
    privacy: "Your privacy matters.",
    terms: "Terms of service",
  };
  if (!titles[publicPage]) notFound();
  const centers =
    publicPage === "service-centers"
      ? await db.serviceCenter.findMany({
          where: { active: true },
          include: { services: { where: { active: true } } },
          take: 100,
        })
      : [];
  return (
    <>
      <header className="public-header">
        <Brand />
        <Link href="/login" className="button button-outline">
          Log in
        </Link>
      </header>
      <main id="main" className="readable">
        <span className="eyebrow">
          FIXFLOW / {publicPage.toUpperCase().replaceAll("-", " ")}
        </span>
        <h1>{titles[publicPage]}</h1>
        {publicPage === "service-centers" ? (
          <>
            <p>
              Explore services and book a time that works for you. Starting
              prices are indicative; final repair charges require your approval.
            </p>
            <div className="form-stack">
              {centers.length ? (
                centers.map((c) => (
                  <article key={c.id} className="center-card">
                    <h2>{c.name}</h2>
                    <p>{c.description}</p>
                    <p>
                      {c.address} · {c.district}
                      <br />
                      {c.phone} · {c.openHour}:00–{c.closeHour}:00 ({c.timezone}
                      )
                    </p>
                    {c.services.map((s) => (
                      <div key={s.id} className="list-row">
                        <div>
                          <strong>{s.name}</strong>
                          <p>{s.duration} minutes</p>
                        </div>
                        <span>From {money(s.startingPrice)}</span>
                      </div>
                    ))}
                    <Link
                      href="/dashboard/appointments"
                      className="button button-primary"
                      style={{ marginTop: 20 }}
                    >
                      Book a service
                    </Link>
                  </article>
                ))
              ) : (
                <div className="empty">
                  <h3>No centers available yet</h3>
                  <p>
                    Service centers will appear here once activated by the
                    platform administrator.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : publicPage === "contact" ? (
          <>
            <p>
              For appointment, repair, or payment questions, contact your
              service center directly using the details in the service center
              directory.
            </p>
            <Link className="button button-primary" href="/service-centers">
              Find your service center
            </Link>
            <h2>Workshop onboarding</h2>
            <p>
              This installation is operated by its deployment owner. Ask your
              platform administrator to create your service center and manager
              account. Public registration creates vehicle owner accounts only.
            </p>
          </>
        ) : publicPage === "privacy" ? (
          <>
            <p>
              FixFlow stores the account, vehicle, appointment, inspection, and
              billing information needed to operate vehicle service workflows.
              Your records are available to you and authorized staff handling
              your work.
            </p>
            <h2>Sessions and records</h2>
            <p>
              Essential session cookies keep you signed in. Financial and
              service records are retained to preserve workshop history.
              Archiving a vehicle does not erase these records. Contact the
              deployment operator to request access, correction, or account
              closure.
            </p>
            <h2>Deployment notice</h2>
            <p>
              This is a portfolio application policy summary. A commercial
              operator must publish its identity, retention schedule, contact
              details, and applicable privacy terms before accepting public
              customers.
            </p>
          </>
        ) : (
          <>
            <p>
              FixFlow coordinates service bookings and workshop records. An
              appointment request is subject to confirmation by your chosen
              service center. Estimates must be approved before chargeable
              repairs proceed.
            </p>
            <h2>Payments and maintenance</h2>
            <p>
              Payments are recorded manually by the workshop. FixFlow does not
              process online payments. Maintenance reminders are configurable
              estimates and do not replace professional inspections or
              manufacturer guidance.
            </p>
            <h2>Operator terms</h2>
            <p>
              The deployment operator must provide its business terms, dispute
              process, and applicable service conditions before commercial use.
            </p>
          </>
        )}
      </main>
    </>
  );
}
