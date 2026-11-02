import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="onboarding">
      <h1>This page isn’t in the toolbox.</h1>
      <Link href="/" className="button primary">
        Back to LendLoop
      </Link>
    </main>
  );
}
