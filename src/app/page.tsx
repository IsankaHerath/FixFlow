import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  ShieldCheck,
  Sparkles,
  Wrench,
  Bell,
  Activity,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { MobilePublicNav } from "@/components/mobile-public-nav";
const features = [
  {
    icon: CalendarDays,
    title: "A service that fits your schedule",
    text: "Find a center, choose an available time, and book your next service in a few simple steps.",
  },
  {
    icon: Activity,
    title: "Every repair, in the clear",
    text: "Follow real workshop updates from the first inspection to the final quality check.",
  },
  {
    icon: FileText,
    title: "Know the cost. Then give the go.",
    text: "Review itemized estimates and approve the work before repairs begin.",
  },
  {
    icon: Bell,
    title: "Stay a step ahead of maintenance",
    text: "Keep service history in one place, with reminders based on mileage and time.",
  },
];
export default function Home() {
  return (
    <div className="marketing">
      <header className="public-header">
        <Brand />
        <nav aria-label="Main">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/service-centers">Service centers</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="header-actions">
          <MobilePublicNav />
          <Link href="/login">Log in</Link>
          <Button asChild size="sm">
            <Link href="/register">
              Get started <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> A BETTER WAY TO CARE FOR YOUR
              VEHICLE
            </div>
            <h1>
              Less uncertainty.
              <br />
              More <span>open road.</span>
            </h1>
            <p>
              From your next service to your last repair, bring all your vehicle
              care together. Simple bookings. Clear estimates. Progress you can
              see.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/register">
                  Take care of your vehicle <ArrowRight size={18} />
                </Link>
              </Button>
              <Link href="#how-it-works" className="text-link">
                See how it works <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="hero-assurance">
              <span>
                <Check size={15} /> Transparent repair approvals
              </span>
              <span>
                <Check size={15} /> Your complete service history
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-grid" />
            <div className="visual-heading">
              <span>VEHICLE CARE, CONNECTED</span>
              <span>01 / 04</span>
            </div>
            <svg
              className="car-art"
              viewBox="0 0 660 300"
              role="img"
              aria-label="Illustration of a modern car"
            >
              <defs>
                <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#e0eeee" />
                  <stop offset=".5" stopColor="#85a8b1" />
                  <stop offset="1" stopColor="#2c5262" />
                </linearGradient>
              </defs>
              <ellipse
                cx="333"
                cy="248"
                rx="265"
                ry="22"
                fill="#061b29"
                opacity=".5"
              />
              <path
                d="M77 190 102 149 203 128 276 67 Q297 53 340 55 L426 61 Q453 66 485 120 L555 146 590 185 579 222 91 225Z"
                fill="url(#body)"
                stroke="#b7d2d7"
                strokeWidth="2"
              />
              <path
                d="m222 128 68-59 51-2-2 61Zm132 0 1-60 65 5 50 55Z"
                fill="#102b3c"
                stroke="#91b4c0"
                strokeWidth="3"
              />
              <path
                d="M88 184 219 163 523 163 574 185M338 134v76M210 140l-8 65"
                fill="none"
                stroke="#365e70"
                strokeWidth="3"
              />
              <path
                d="m93 173 70-14-13 22-63 10M546 154l27 22-29-5"
                fill="#e1fcfc"
              />
              <path
                d="m89 202 54-5m385-3 49 8"
                stroke="#0d2735"
                strokeWidth="9"
              />
              <g fill="#0b1b26" stroke="#547786" strokeWidth="8">
                <circle cx="180" cy="218" r="42" />
                <circle cx="487" cy="218" r="42" />
              </g>
              <g fill="#9aafb7" stroke="#d4e2e4" strokeWidth="3">
                <circle cx="180" cy="218" r="23" />
                <circle cx="487" cy="218" r="23" />
              </g>
              <g fill="#163645">
                <circle cx="180" cy="218" r="8" />
                <circle cx="487" cy="218" r="8" />
              </g>
            </svg>
            <div className="preview-card">
              <div className="preview-icon">
                <Wrench size={22} />
              </div>
              <div>
                <small>ONE CONNECTED JOURNEY</small>
                <strong>From booking to back on the road</strong>
              </div>
              <CheckCircle2 className="teal" size={23} />
              <div className="preview-stages">
                <span className="done">Booking</span>
                <i />
                <span className="done">Inspection</span>
                <i />
                <span>Repair</span>
                <i />
                <span>Ready</span>
              </div>
            </div>
            <div className="visual-caption">
              <ShieldCheck size={17} /> You’re in control, at every turn.
              <span>FIXFLOW</span>
            </div>
          </div>
        </section>
        <section className="value-strip">
          <span>BUILT AROUND YOUR JOURNEY</span>
          <div>
            <CarFront /> All your vehicles
          </div>
          <div>
            <ClipboardList /> Every service record
          </div>
          <div>
            <ShieldCheck /> No surprise repairs
          </div>
          <div>
            <Wrench /> Connected workshops
          </div>
        </section>
        <section id="features" className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                VEHICLE CARE, WITHOUT THE GUESSWORK
              </span>
              <h2>
                A little less admin.
                <br />A lot more peace of mind.
              </h2>
            </div>
            <p>
              No more scattered records or chasing updates.
              <br />
              Just a clear picture of your vehicle’s care.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((f, i) => (
              <article className="feature-card" key={f.title}>
                <span className="feature-icon">
                  <f.icon size={25} />
                </span>
                <small>0{i + 1}</small>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <Link href="/register" aria-label={`Get started: ${f.title}`}>
                  <ArrowUpRight size={21} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <div>
            <span className="eyebrow">FROM YOUR DRIVEWAY TO THE WORKSHOP</span>
            <h2>
              Your next service.
              <br />
              Already simpler.
            </h2>
            <p>
              A connected experience for vehicle owners
              <br />
              and the people who keep them moving.
            </p>
            <Button asChild>
              <Link href="/service-centers">
                Explore service centers <ArrowRight size={17} />
              </Link>
            </Button>
          </div>
          <ol className="steps">
            {[
              [
                "Make it yours",
                "Create your account and add your vehicle details.",
              ],
              [
                "Find your time",
                "Choose a service center and request an available slot.",
              ],
              [
                "Stay in the loop",
                "Approve estimates, follow repairs, and save every record.",
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <b>0{i + 1}</b>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="section two-panels">
          <article className="owner-panel">
            <CarFront size={32} />
            <span className="eyebrow">FOR VEHICLE OWNERS</span>
            <h2>
              Your vehicle’s story.
              <br />
              All in one place.
            </h2>
            <p>
              Keep track of your cars, motorcycles, vans, and more. Every visit
              adds to a history that stays with your vehicle.
            </p>
            <Link href="/register" className="text-link">
              Create your account <ArrowRight size={17} />
            </Link>
          </article>
          <article className="workshop-panel">
            <Wrench size={32} />
            <span className="eyebrow">FOR SERVICE CENTERS</span>
            <h2>
              A clearer view.
              <br />A smoother workshop.
            </h2>
            <p>
              Connect appointments, technicians, inventory, approvals, and
              invoices in one organized workspace.
            </p>
            <Link href="/contact" className="text-link">
              Bring your workshop to FixFlow <ArrowRight size={17} />
            </Link>
          </article>
        </section>
        <section className="faq section">
          <span className="eyebrow">GOOD TO KNOW</span>
          <h2>A few answers before you go.</h2>
          {[
            [
              "Do I approve repairs before work begins?",
              "Yes. Your center sends an itemized estimate for you to approve or reject. A revised estimate pauses the repair until you approve the new version.",
            ],
            [
              "Can I manage more than one vehicle?",
              "Yes. Add each vehicle to your account and keep bookings, maintenance records, and reminders organized by vehicle.",
            ],
            [
              "How are maintenance reminders calculated?",
              "Reminders use the service interval configured by your workshop, your recorded mileage, and the service date. They are helpful estimates, not mechanical predictions.",
            ],
            [
              "Can I pay online?",
              "FixFlow currently records manual cash, bank transfer, and other manual payments through your service center. Online payment processing is not included.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="final-cta">
          <Sparkles size={27} />
          <h2>Good care starts with a clear plan.</h2>
          <p>
            Give your vehicle a little more attention. And yourself a little
            less to think about.
          </p>
          <Button asChild>
            <Link href="/register">
              Get started with FixFlow <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="public-footer">
        <div>
          <Brand />
          <p>
            Your vehicle. Our priority.
            <br />
            Every service, simplified.
          </p>
        </div>
        <div>
          <strong>Product</strong>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/service-centers">Service centers</Link>
        </div>
        <div>
          <strong>Connect</strong>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Log in</Link>
          <Link href="/register">Get started</Link>
        </div>
        <div>
          <strong>Legal</strong>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
          <span>© {new Date().getFullYear()} FixFlow</span>
        </div>
      </footer>
    </div>
  );
}
