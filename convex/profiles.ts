import { mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { admin, audit, clean, identity } from "./model";
export const me = query({
  args: {},
  handler: async (ctx) => {
    const who = await identity(ctx);
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_subject", (q) => q.eq("subject", who.subject))
      .unique();
    return p
      ? {
          _id: p._id,
          displayName: p.displayName,
          role: p.role,
          trusted: p.trusted,
        }
      : null;
  },
});
export const register = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const who = await identity(ctx);
    const old = await ctx.db
      .query("profiles")
      .withIndex("by_subject", (q) => q.eq("subject", who.subject))
      .unique();
    if (old) return old._id;
    return ctx.db.insert("profiles", {
      subject: who.subject,
      displayName: clean(args.displayName, 60, "Display name"),
      role: "user",
      trusted: false,
    });
  },
});
export const setTrusted = mutation({
  args: { profileId: v.id("profiles"), trusted: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await admin(ctx);
    if (!(await ctx.db.get(args.profileId)))
      throw new ConvexError("Lender not found.");
    await ctx.db.patch(args.profileId, { trusted: args.trusted });
    await audit(
      ctx,
      actor._id,
      args.trusted ? "lender.trusted" : "lender.untrusted",
      args.profileId,
    );
  },
});
// Dashboard/CLI only. No public function can change roles.
export const setRole = internalMutation({
  args: {
    subject: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_subject", (q) => q.eq("subject", args.subject))
      .unique();
    if (!p)
      throw new ConvexError(
        "Ask the user to sign in and complete their profile first.",
      );
    await ctx.db.patch(p._id, { role: args.role });
    await audit(ctx, p._id, `operator.role.${args.role}`, p._id);
  },
});
