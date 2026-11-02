import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export const category = v.union(
  v.literal("Power tools"),
  v.literal("Garden"),
  v.literal("Kitchen"),
  v.literal("Camping"),
  v.literal("Other"),
);
export const condition = v.union(
  v.literal("Like new"),
  v.literal("Good"),
  v.literal("Well used"),
);
export const status = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);
export default defineSchema({
  profiles: defineTable({
    subject: v.string(),
    displayName: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    trusted: v.boolean(),
  }).index("by_subject", ["subject"]),
  tools: defineTable({
    ownerId: v.id("profiles"),
    name: v.string(),
    category,
    condition,
    description: v.string(),
    removed: v.boolean(),
    revision: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_removed", ["removed"]),
  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("profiles"),
    borrowerId: v.id("profiles"),
    start: v.string(),
    end: v.string(),
    status,
    clientKey: v.string(),
    updatedAt: v.number(),
  })
    .index("by_tool_status", ["toolId", "status"])
    .index("by_owner", ["ownerId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_client", ["borrowerId", "clientKey"])
    .index("by_status_end", ["status", "end"]),
  events: defineTable({
    loanId: v.id("loans"),
    kind: v.union(v.literal("request"), v.literal("reminder")),
    key: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("simulated"),
      v.literal("failed"),
    ),
    loanStatus: status,
    recipientId: v.id("profiles"),
    attempts: v.number(),
    nextAttempt: v.number(),
    leaseUntil: v.optional(v.number()),
    processingToken: v.optional(v.string()),
    claimedToken: v.optional(v.string()),
    lastError: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_loan", ["loanId"])
    .index("by_status_next", ["status", "nextAttempt"]),
  receipts: defineTable({
    nonce: v.string(),
    fingerprint: v.string(),
    response: v.string(),
    expiresAt: v.number(),
  })
    .index("by_nonce", ["nonce"])
    .index("by_expiry", ["expiresAt"]),
  notificationResults: defineTable({
    eventId: v.id("events"),
    outcome: v.literal("simulated"),
    executionId: v.string(),
    at: v.number(),
  }).index("by_event", ["eventId"]),
  audit: defineTable({
    actorId: v.id("profiles"),
    action: v.string(),
    recordId: v.string(),
    at: v.number(),
  }),
});
