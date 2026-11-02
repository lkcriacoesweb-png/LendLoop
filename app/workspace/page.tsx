import { LiveWorkspace } from "@/components/live-workspace";
import Link from "next/link";
export default function Page() {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.NEXT_PUBLIC_CONVEX_URL
  )
    return (
      <main id="main" className="onboarding">
        <h1>Connect your neighborhood.</h1>
        <p>
          Clerk and Convex are not configured yet. Follow the local setup in the
          README.
        </p>
        <Link className="button primary" href="/preview">
          Open the local preview
        </Link>
      </main>
    );
  return <LiveWorkspace />;
}
