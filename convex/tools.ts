import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { category, condition } from "./schema";
import { profile, clean, audit, enqueue } from "./model";
import { todayUTC } from "../lib/domain";
const fields = {
  name: v.string(),
  category,
  condition,
  description: v.string(),
};
export const publicAvailable = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_removed", (q) => q.eq("removed", false))
      .take(200);
    const output: { name: string; category: string }[] = [];
    const today = todayUTC();
    for (const tool of tools) {
      const approved = await ctx.db
        .query("loans")
        .withIndex("by_tool_status", (q) =>
          q.eq("toolId", tool._id).eq("status", "approved"),
        )
        .collect();
      if (!approved.some((loan) => loan.start <= today))
        output.push({ name: tool.name, category: tool.category });
    }
    return output; // Explicit allow-list: no IDs, owner, descriptions or loan data.
  },
});
export const browse = query({
  args: {},
  handler: async (ctx) => {
    await profile(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_removed", (q) => q.eq("removed", false))
      .take(200);
    return Promise.all(
      tools.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        const reservations = await ctx.db
          .query("loans")
          .withIndex("by_tool_status", (q) =>
            q.eq("toolId", tool._id).eq("status", "approved"),
          )
          .collect();
        return {
          ...tool,
          ownerName: owner?.displayName ?? "Neighbor",
          trusted: owner?.trusted ?? false,
          reservations: reservations.map(({ start, end }) => ({ start, end })),
          available: !reservations.some((r) => r.start <= todayUTC()),
        };
      }),
    );
  },
});
export const create = mutation({
  args: fields,
  handler: async (ctx, args) => {
    const user = await profile(ctx);
    const owned = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    if (owned.filter((t) => !t.removed).length >= 30)
      throw new ConvexError("You may have up to 30 active listings.");
    const id = await ctx.db.insert("tools", {
      ...args,
      name: clean(args.name, 80, "Name"),
      description: clean(args.description, 400, "Description"),
      ownerId: user._id,
      removed: false,
      revision: 0,
    });
    await audit(ctx, user._id, "tool.created", id);
    return id;
  },
});
export const edit = mutation({
  args: { id: v.id("tools"), ...fields },
  handler: async (ctx, { id, ...args }) => {
    const user = await profile(ctx);
    const tool = await ctx.db.get(id);
    if (!tool || tool.ownerId !== user._id || tool.removed)
      throw new ConvexError("You can only edit your active listings.");
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", id))
      .collect();
    if (loans.some((l) => l.status === "pending" || l.status === "approved"))
      throw new ConvexError(
        "Resolve active requests and loans before editing.",
      );
    await ctx.db.patch(id, {
      ...args,
      name: clean(args.name, 80, "Name"),
      description: clean(args.description, 400, "Description"),
      revision: tool.revision + 1,
    });
    await audit(ctx, user._id, "tool.edited", id);
  },
});
export const remove = mutation({
  args: { id: v.id("tools") },
  handler: async (ctx, { id }) => {
    const user = await profile(ctx);
    const tool = await ctx.db.get(id);
    if (!tool || (tool.ownerId !== user._id && user.role !== "admin"))
      throw new ConvexError("You cannot remove this listing.");
    if (tool.removed) return;
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", id))
      .collect();
    if (user.role !== "admin" && loans.some((l) => l.status === "approved"))
      throw new ConvexError("Record the return before removing this listing.");
    await ctx.db.patch(id, { removed: true, revision: tool.revision + 1 });
    for (const loan of loans.filter((l) => l.status === "pending")) {
      await ctx.db.patch(loan._id, {
        status: "declined",
        updatedAt: Date.now(),
      });
      await enqueue(
        ctx,
        { ...loan, status: "declined" },
        `${loan._id}:declined`,
      );
    }
    await audit(ctx, user._id, "tool.removed", id);
  },
});
