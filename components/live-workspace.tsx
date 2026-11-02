"use client";
import { useState, type FormEvent } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { UserButton, SignInButton } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Workspace } from "./workspace";
export function LiveWorkspace() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading)
    return (
      <main id="main" className="onboarding" role="status">
        Connecting your neighborhood…
      </main>
    );
  if (!isAuthenticated)
    return (
      <main id="main" className="onboarding">
        <h1>Welcome, neighbor.</h1>
        <SignInButton mode="modal">
          <button className="button primary">Sign in to continue</button>
        </SignInButton>
      </main>
    );
  return <ProfileGate />;
}
function ProfileGate() {
  const me = useQuery(api.profiles.me, {});
  const register = useMutation(api.profiles.register);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const displayName = String(
      new FormData(e.currentTarget).get("displayName"),
    );
    setBusy(true);
    try {
      await register({ displayName });
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (me === undefined)
    return (
      <main id="main" className="onboarding" role="status">
        Loading your profile…
      </main>
    );
  if (me === null)
    return (
      <main id="main" className="onboarding">
        <h1>What should we call you?</h1>
        <p>
          Your display name is visible to signed-in neighbors. A nickname is
          welcome.
        </p>
        <form onSubmit={submit}>
          <label>
            Display name
            <input name="displayName" required maxLength={60} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>
            Join the neighborhood
          </button>
        </form>
      </main>
    );
  return <Connected me={me} />;
}
function Connected({
  me,
}: {
  me: { _id: Id<"profiles">; displayName: string; role: "admin" | "user" };
}) {
  const tools = useQuery(api.tools.browse, {});
  const mine = useQuery(api.loans.mine, {});
  const all = useQuery(api.loans.all, me.role === "admin" ? {} : "skip");
  const failures = useQuery(
    api.automation.failures,
    me.role === "admin" ? {} : "skip",
  );
  const create = useMutation(api.tools.create);
  const edit = useMutation(api.tools.edit);
  const remove = useMutation(api.tools.remove);
  const request = useMutation(api.loans.request);
  const change = useMutation(api.loans.changeStatus);
  const trust = useMutation(api.profiles.setTrusted);
  const retry = useMutation(api.automation.retry);
  if (!tools || !mine || (me.role === "admin" && !all))
    return (
      <main id="main" className="onboarding" role="status">
        Opening the toolbox…
      </main>
    );
  return (
    <Workspace
      person={me}
      tools={tools}
      loans={me.role === "admin" ? all! : mine}
      failures={failures}
      account={<UserButton />}
      create={create}
      edit={(id, data) => edit({ id: id as Id<"tools">, ...data })}
      remove={(id) => remove({ id: id as Id<"tools"> })}
      request={(id, start, end, clientKey) =>
        request({ toolId: id as Id<"tools">, start, end, clientKey })
      }
      change={(id, status) => change({ id: id as Id<"loans">, status })}
      trust={(id, trusted) =>
        trust({ profileId: id as Id<"profiles">, trusted })
      }
      retry={(id) => retry({ id: id as Id<"events"> })}
    />
  );
}
