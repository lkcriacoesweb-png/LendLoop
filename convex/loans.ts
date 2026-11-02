import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { status } from "./schema";
import {
  admin,
  profile,
  assertParticipant,
  enqueue,
  audit,
  clean,
} from "./model";
import {
  validateDates,
  overlaps,
  transitionAllowed,
  todayUTC,
} from "../lib/domain";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
async function present(ctx: QueryCtx, loan: Doc<"loans">) {
  const tool = await ctx.db.get(loan.toolId);
  const owner = await ctx.db.get(loan.ownerId);
  const borrower = await ctx.db.get(loan.borrowerId);
  const events = await ctx.db
    .query("events")
    .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
    .order("desc")
    .take(5);
  return {
    ...loan,
    toolName: tool?.name ?? "Removed listing",
    ownerName: owner?.displayName ?? "Neighbor",
    borrowerName: borrower?.displayName ?? "Neighbor",
    overdue: loan.status === "approved" && loan.end < todayUTC(),
    activity: events.map((e) => ({
      _id: e._id,
      kind: e.kind,
      status: e.status,
      attempts: e.attempts,
      at: e.completedAt ?? e._creationTime,
    })),
  };
}
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await profile(ctx);
    const outgoing = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(200);
    const incoming = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(200);
    return Promise.all([...outgoing, ...incoming].map((l) => present(ctx, l)));
  },
});
export const all = query({
  args: {},
  handler: async (ctx) => {
    await admin(ctx);
    return Promise.all(
      (await ctx.db.query("loans").order("desc").take(200)).map((l) =>
        present(ctx, l),
      ),
    );
  },
});
export const get = query({
  args: { id: v.id("loans") },
  handler: async (ctx, { id }) => {
    const user = await profile(ctx);
    const loan = await ctx.db.get(id);
    if (!loan) return null;
    assertParticipant(loan, user);
    return present(ctx, loan);
  },
});
export const request = mutation({
  args: {
    toolId: v.id("tools"),
    start: v.string(),
    end: v.string(),
    clientKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await profile(ctx);
    clean(args.clientKey, 100, "Request key");
    const old = await ctx.db
      .query("loans")
      .withIndex("by_client", (q) =>
        q.eq("borrowerId", user._id).eq("clientKey", args.clientKey),
      )
      .unique();
    if (old) {
      if (
        old.toolId !== args.toolId ||
        old.start !== args.start ||
        old.end !== args.end
      )
        throw new ConvexError("Request key already used.");
      return old._id;
    }
    try {
      validateDates(args.start, args.end);
    } catch (e) {
      throw new ConvexError((e as Error).message);
    }
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.removed)
      throw new ConvexError("This listing is no longer available.");
    if (tool.ownerId === user._id)
      throw new ConvexError("You cannot borrow your own tool.");
    const reservations = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", args.toolId))
      .collect();
    if (
      reservations.some(
        (l) =>
          l.status === "approved" && (l.end < todayUTC() || overlaps(l, args)),
      )
    )
      throw new ConvexError(
        "This tool is reserved for those dates or awaiting return.",
      );
    if (
      reservations.some(
        (l) =>
          l.borrowerId === user._id &&
          l.status === "pending" &&
          overlaps(l, args),
      )
    )
      throw new ConvexError(
        "You already have a pending request for these dates.",
      );
    const active = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .collect();
    if (
      active.filter((l) => l.status === "pending" || l.status === "approved")
        .length >= 20
    )
      throw new ConvexError(
        "Resolve your existing requests before creating more.",
      );
    const id = await ctx.db.insert("loans", {
      ...args,
      ownerId: tool.ownerId,
      borrowerId: user._id,
      status: "pending",
      updatedAt: Date.now(),
    });
    await enqueue(ctx, (await ctx.db.get(id))!, `${id}:pending`);
    await audit(ctx, user._id, "loan.requested", id);
    return id;
  },
});
export const changeStatus = mutation({
  args: { id: v.id("loans"), status },
  handler: async (ctx, args) => {
    const user = await profile(ctx);
    const loan = await ctx.db.get(args.id);
    if (!loan) throw new ConvexError("Loan not found.");
    const actor =
      loan.ownerId === user._id
        ? "owner"
        : loan.borrowerId === user._id
          ? "borrower"
          : "other";
    // Check authorization before duplicate handling. Admin has no special return/approval power.
    const permitted =
      (actor === "owner" &&
        ["approved", "declined", "returned"].includes(args.status)) ||
      (actor === "borrower" && args.status === "cancelled");
    if (!permitted) throw new ConvexError("You cannot make this change.");
    if (loan.status === args.status) return;
    if (!transitionAllowed(loan.status, args.status, actor))
      throw new ConvexError("This status change is not allowed.");
    if (args.status === "approved") {
      try {
        validateDates(loan.start, loan.end);
      } catch (e) {
        throw new ConvexError((e as Error).message);
      }
      const tool = await ctx.db.get(loan.toolId);
      if (!tool || tool.removed)
        throw new ConvexError("The listing was removed.");
      const reserved = await ctx.db
        .query("loans")
        .withIndex("by_tool_status", (q) =>
          q.eq("toolId", loan.toolId).eq("status", "approved"),
        )
        .collect();
      if (reserved.some((l) => overlaps(l, loan) || l.end < todayUTC()))
        throw new ConvexError("Another loan overlaps or is awaiting return.");
      // The indexed read and shared tool write are in this same serializable transaction.
      await ctx.db.patch(tool._id, { revision: tool.revision + 1 });
    }
    await ctx.db.patch(loan._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    await enqueue(
      ctx,
      { ...loan, status: args.status },
      `${loan._id}:${args.status}`,
    );
    await audit(ctx, user._id, `loan.${args.status}`, loan._id);
  },
});
