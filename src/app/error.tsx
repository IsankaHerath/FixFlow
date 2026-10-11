"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="error-page">
      <h1>Something interrupted your journey.</h1>
      <p className="muted">
        We couldn’t load this page. Please retry. If the issue continues, check
        that the application database is available.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
