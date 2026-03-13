import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // Mirrored from WorkOS
    workosId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),

    // App specific
    isAdmin: v.optional(v.boolean()),
    onboardingComplete: v.optional(v.boolean()),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_workos_id", ["workosId"])
    .index("by_email", ["email"]),

  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
});
