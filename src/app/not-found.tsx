import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="error-page">
      <h1>That page is off the map.</h1>
      <p className="muted">The page or record could not be found.</p>
      <Link className="button button-primary" href="/dashboard">
        Back to your workspace
      </Link>
    </main>
  );
}
