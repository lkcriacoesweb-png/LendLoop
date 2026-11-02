import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
export const demo = internalMutation({
  args: { ownerSubject: v.string(), borrowerSubject: v.string() },
  handler: async (ctx, args) => {
    if (process.env.ENABLE_DEMO_SEED !== "true")
      throw new ConvexError("Development seed is disabled.");
    if (args.ownerSubject === args.borrowerSubject)
      throw new ConvexError("Use two different test accounts.");
    const owner = await ctx.db
      .query("profiles")
      .withIndex("by_subject", (q) => q.eq("subject", args.ownerSubject))
      .unique();
    const borrower = await ctx.db
      .query("profiles")
      .withIndex("by_subject", (q) => q.eq("subject", args.borrowerSubject))
      .unique();
    if (!owner || !borrower)
      throw new ConvexError("Create both test profiles first.");
    if (
      await ctx.db
        .query("tools")
        .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
        .first()
    )
      throw new ConvexError("Seed only into an empty test owner.");
    const drill = await ctx.db.insert("tools", {
      ownerId: owner._id,
      name: "Cordless drill",
      category: "Power tools",
      condition: "Good",
      description: "Fictional demo tool. Includes a charger and bit set.",
      removed: false,
      revision: 0,
    });
    await ctx.db.insert("tools", {
      ownerId: owner._id,
      name: "Weekend tent",
      category: "Camping",
      condition: "Like new",
      description:
        "Fictional demo tool. Two-person tent for your next adventure.",
      removed: false,
      revision: 0,
    });
    const day = (delta: number) =>
      new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
    await ctx.db.insert("loans", {
      toolId: drill,
      ownerId: owner._id,
      borrowerId: borrower._id,
      start: day(-4),
      end: day(-1),
      status: "approved",
      clientKey: "development-overdue-seed",
      updatedAt: Date.now(),
    });
    return { seeded: true };
  },
});
