"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="onboarding">
      <h1>Something went wrong.</h1>
      <p>We couldn’t load this view. Your saved changes are safe.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
