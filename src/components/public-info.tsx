import Link from "next/link";
import { Brand } from "./brand";
const content: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  features: {
    title: "Your vehicle care, connected.",
    intro:
      "A single place for the details that matter, from the first booking to the next service.",
    sections: [
      [
        "Book around your day",
        "Choose a center, compare its service catalog, and request an available slot. Workshop capacity and your vehicle’s schedule are checked when you book.",
      ],
      [
        "Approve with confidence",
        "Review itemized parts and labor before repairs start. A changed estimate requires a new decision, and your original approval stays on record.",
      ],
      [
        "Follow every stage",
        "See inspection findings, repair tasks and a timestamped service timeline. Your workshop records real progress updates.",
      ],
      [
        "Keep the complete record",
        "Download invoices, view manual payment records, and follow time- and mileage-based maintenance reminders.",
      ],
    ],
  },
  "how-it-works": {
    title: "From booking to back on the road.",
    intro: "One connected journey for you and your workshop.",
    sections: [
      [
        "01 · Add your vehicle",
        "Create an owner account, record your registration and mileage, then find an active service center.",
      ],
      [
        "02 · Book a service",
        "Choose a service and time. Your manager confirms the appointment and checks in the vehicle when it arrives.",
      ],
      [
        "03 · Inspect and approve",
        "A technician records the inspection. Your manager sends a repair estimate for your approval.",
      ],
      [
        "04 · Follow, collect, and maintain",
        "Follow repairs and the quality check, download your invoice, and keep the completed service in your vehicle history.",
      ],
    ],
  },
  "for-customers": {
    title: "A clearer picture of vehicle care.",
    intro:
      "Keep your vehicles, service appointments and repair records together.",
    sections: [
      [
        "Your information stays yours",
        "Your account can access your own vehicles and repair records. Workshop staff see only records permitted by their center membership and job assignment.",
      ],
      [
        "Your approval comes first",
        "Choose whether to approve or reject an estimate. Work pauses for a fresh decision when an estimate changes.",
      ],
      [
        "Your next service is easier",
        "Your mileage history and completed services help calculate configurable maintenance reminders.",
      ],
    ],
  },
  "for-service-centers": {
    title: "Keep your workshop in sync.",
    intro:
      "Turn disconnected appointments, technician notes and invoices into one consistent workflow.",
    sections: [
      [
        "Organize the day",
        "Configure opening hours, closures and appointment capacity. Confirm bookings and assign active technicians.",
      ],
      [
        "Connect your operations",
        "Keep inspections, approved estimates, tasks, parts movements and labor entries alongside the job.",
      ],
      [
        "Know your business",
        "Issue immutable invoices, record manual payments, and review revenue, appointment trends and outstanding balances.",
      ],
      [
        "Join the platform",
        "Contact your deployment administrator to create a center and manager account. New centers require approval before customer booking.",
      ],
    ],
  },
};
export function PublicInfo({ page }: { page: string }) {
  const info = content[page];
  return (
    <>
      <header className="public-header">
        <Brand />
        <Link className="button button-primary" href="/register">
          Get started
        </Link>
      </header>
      <main id="main" className="readable">
        <span className="eyebrow">
          FIXFLOW / {page.replaceAll("-", " ").toUpperCase()}
        </span>
        <h1>{info.title}</h1>
        <p>{info.intro}</p>
        {info.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <div className="inline-actions">
          <Link className="button button-primary" href="/service-centers">
            Explore service centers
          </Link>
          <Link className="button button-outline" href="/contact">
            Contact
          </Link>
        </div>
      </main>
    </>
  );
}
