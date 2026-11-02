import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
export async function identity(ctx: QueryCtx | MutationCtx) {
  const who = await ctx.auth.getUserIdentity();
  if (!who) throw new ConvexError("Sign in to continue.");
  return who;
}
export async function profile(ctx: QueryCtx | MutationCtx) {
  const who = await identity(ctx);
  const user = await ctx.db
    .query("profiles")
    .withIndex("by_subject", (q) => q.eq("subject", who.subject))
    .unique();
  if (!user) throw new ConvexError("Complete your profile first.");
  return user;
}
export async function admin(ctx: QueryCtx | MutationCtx) {
  const user = await profile(ctx);
  if (user.role !== "admin")
    throw new ConvexError("Administrator access required.");
  return user;
}
export function clean(value: string, max: number, label: string) {
  const result = value.trim();
  if (!result || result.length > max)
    throw new ConvexError(`${label} must contain 1–${max} characters.`);
  return result;
}
export async function audit(
  ctx: MutationCtx,
  actorId: Id<"profiles">,
  action: string,
  recordId: string,
) {
  await ctx.db.insert("audit", { actorId, action, recordId, at: Date.now() });
}
export function assertParticipant(loan: Doc<"loans">, user: Doc<"profiles">) {
  if (
    user.role !== "admin" &&
    loan.ownerId !== user._id &&
    loan.borrowerId !== user._id
  )
    throw new ConvexError("This loan is private.");
}
export async function enqueue(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  key: string,
  kind: "request" | "reminder" = "request",
) {
  const old = await ctx.db
    .query("events")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (old) return old._id;
  return ctx.db.insert("events", {
    loanId: loan._id,
    key,
    kind,
    status: "pending",
    loanStatus: loan.status,
    recipientId:
      kind === "reminder" ||
      ["approved", "declined", "returned"].includes(loan.status)
        ? loan.borrowerId
        : loan.ownerId,
    attempts: 0,
    nextAttempt: Date.now(),
  });
}
