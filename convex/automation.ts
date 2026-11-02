import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { admin, audit, enqueue } from "./model";
import { todayUTC } from "../lib/domain";
import type { Doc } from "./_generated/dataModel";
const MAX_ATTEMPTS = 5;
export function payload(e: Doc<"events">) {
  return {
    eventId: e._id,
    token: e.processingToken!,
    kind: e.kind,
    status: e.loanStatus,
    recipientRef: e.recipientId,
  };
}
export const due = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("events")
      .withIndex("by_status_next", (q) =>
        q.eq("status", "pending").lte("nextAttempt", Date.now()),
      )
      .take(50);
    const processing = await ctx.db
      .query("events")
      .withIndex("by_status_next", (q) =>
        q.eq("status", "processing").lte("nextAttempt", Date.now()),
      )
      .take(50);
    return [...pending, ...processing]
      .filter((e) => e.kind === "request")
      .slice(0, 10)
      .map((e) => e._id);
  },
});
export const start = internalMutation({
  args: { id: v.id("events"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    const e = await ctx.db.get(id);
    if (
      !e ||
      e.status === "simulated" ||
      e.status === "failed" ||
      e.nextAttempt > Date.now()
    )
      return null;
    if (e.attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch(id, {
        status: "failed",
        lastError: "Delivery attempts exhausted.",
      });
      return null;
    }
    const patch = {
      status: "processing" as const,
      attempts: e.attempts + 1,
      processingToken: token,
      leaseUntil: Date.now() + 120000,
      nextAttempt: Date.now() + 120000,
    };
    await ctx.db.patch(id, patch);
    return payload({ ...e, ...patch });
  },
});
export const fail = internalMutation({
  args: { id: v.id("events"), token: v.string(), reason: v.string() },
  handler: async (ctx, { id, token, reason }) => {
    const e = await ctx.db.get(id);
    if (!e || e.status === "simulated" || e.processingToken !== token) return;
    await ctx.db.patch(id, {
      status: e.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      lastError: reason.slice(0, 120),
      nextAttempt: Date.now() + 30000 * 2 ** e.attempts,
    });
  },
});
// HTTP operations are internal and run with nonce receipt + effects in ONE transaction.
export const receive = internalMutation({
  args: {
    route: v.string(),
    nonce: v.string(),
    fingerprint: v.string(),
    body: v.any(),
  },
  handler: async (ctx, { route, nonce, fingerprint, body }) => {
    const prior = await ctx.db
      .query("receipts")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ConvexError("Nonce already used.");
      return JSON.parse(prior.response);
    }
    let response: unknown;
    if (route === "/automation/overdue") {
      if (!body || Object.keys(body).length !== 0)
        throw new ConvexError("Expected empty body.");
      const overdue = await ctx.db
        .query("loans")
        .withIndex("by_status_end", (q) =>
          q.eq("status", "approved").lt("end", todayUTC()),
        )
        .take(100);
      const events = [];
      for (const loan of overdue) {
        const id = await enqueue(
          ctx,
          loan,
          `${loan._id}:reminder:${todayUTC()}`,
          "reminder",
        );
        const e = (await ctx.db.get(id))!;
        if (
          e.status === "simulated" ||
          e.status === "failed" ||
          e.nextAttempt > Date.now()
        )
          continue;
        if (e.attempts >= MAX_ATTEMPTS) {
          await ctx.db.patch(id, {
            status: "failed",
            lastError: "Reminder attempts exhausted.",
          });
          continue;
        }
        const patch = {
          status: "processing" as const,
          processingToken: `${nonce}_${id}`,
          attempts: e.attempts + 1,
          leaseUntil: Date.now() + 120000,
          nextAttempt: Date.now() + 120000,
        };
        await ctx.db.patch(id, patch);
        events.push(payload({ ...e, ...patch }));
      }
      response = { events };
    } else {
      if (
        !body ||
        typeof body.eventId !== "string" ||
        typeof body.token !== "string"
      )
        throw new ConvexError("Invalid event reference.");
      const id = ctx.db.normalizeId("events", body.eventId);
      const e = id ? await ctx.db.get(id) : null;
      if (!e) throw new ConvexError("Unknown event.");
      if (route === "/automation/claim") {
        if (Object.keys(body).some((k) => !["eventId", "token"].includes(k)))
          throw new ConvexError("Unexpected field.");
        if (e.status === "simulated" || e.claimedToken === body.token)
          response = { process: false };
        else {
          if (
            e.status !== "processing" ||
            e.processingToken !== body.token ||
            (e.leaseUntil ?? 0) < Date.now()
          )
            throw new ConvexError("Stale delivery attempt.");
          await ctx.db.patch(e._id, { claimedToken: body.token });
          response = { process: true };
        }
      } else if (route === "/automation/complete") {
        if (
          Object.keys(body).some(
            (k) => !["eventId", "token", "executionId", "outcome"].includes(k),
          ) ||
          body.outcome !== "simulated" ||
          typeof body.executionId !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(body.executionId)
        )
          throw new ConvexError("Invalid completion.");
        const result = await ctx.db
          .query("notificationResults")
          .withIndex("by_event", (q) => q.eq("eventId", e._id))
          .unique();
        if (result) response = { outcome: result.outcome, duplicate: true };
        else {
          if (
            e.status !== "processing" ||
            e.processingToken !== body.token ||
            e.claimedToken !== body.token
          )
            throw new ConvexError("Attempt not claimed.");
          await ctx.db.insert("notificationResults", {
            eventId: e._id,
            outcome: "simulated",
            executionId: body.executionId,
            at: Date.now(),
          });
          await ctx.db.patch(e._id, {
            status: "simulated",
            completedAt: Date.now(),
            lastError: undefined,
          });
          response = { outcome: "simulated", duplicate: false };
        }
      } else throw new ConvexError("Unsupported operation.");
    }
    await ctx.db.insert("receipts", {
      nonce,
      fingerprint,
      response: JSON.stringify(response),
      expiresAt: Date.now() + 600000,
    });
    return response;
  },
});
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("receipts")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", Date.now()))
      .take(500);
    for (const receipt of expired) await ctx.db.delete(receipt._id);
    for (const status of ["pending", "processing"] as const) {
      const stale = await ctx.db
        .query("events")
        .withIndex("by_status_next", (q) =>
          q.eq("status", status).lt("nextAttempt", Date.now()),
        )
        .take(100);
      for (const e of stale)
        if (e.kind === "reminder" && !e.key.endsWith(todayUTC()))
          await ctx.db.patch(e._id, {
            status: "failed",
            lastError:
              "Reminder window expired; a new UTC day uses a new reminder.",
          });
    }
  },
});
export const failures = query({
  args: {},
  handler: async (ctx) => {
    await admin(ctx);
    return ctx.db
      .query("events")
      .withIndex("by_status_next", (q) => q.eq("status", "failed"))
      .take(100);
  },
});
export const retry = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    const user = await admin(ctx);
    const e = await ctx.db.get(id);
    if (!e || e.status !== "failed")
      throw new ConvexError("Only failed events can be retried.");
    if (e.kind === "reminder" && !e.key.endsWith(todayUTC()))
      throw new ConvexError(
        "Old reminders are not replayed; use today's reminder.",
      );
    await ctx.db.patch(id, {
      status: "pending",
      attempts: 0,
      nextAttempt: Date.now(),
      lastError: undefined,
    });
    await audit(ctx, user._id, "event.retry", id);
  },
});
