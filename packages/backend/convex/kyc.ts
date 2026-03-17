/**
 * Automated KYC verification pipeline
 */
import { ConvexError, v } from "convex/values";

import { action, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUser } from "./utils";

// We need to use `any` cast temporarily for `internal.kyc` since the types haven't
// generated yet (the file is new), but we know it will exist once Convex syncs.

/**
 * Main action to trigger the identity verification process.
 * Calls out to the simulated external provider and then updates the database.
 */
export const verifyIdentity = action({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch user data and pending documents for the currently authenticated user
    const data = await ctx.runQuery(internal.kyc.getViewerKycData);

    if (data.documents.length === 0) {
      throw new ConvexError("No pending KYC documents found to verify");
    }

    if (data.user.status !== "pending_kyc") {
      throw new ConvexError("User is not in pending_kyc status");
    }

    // 2. Call the provider (Simulation)
    const result = await ctx.runAction(internal.kyc.simulateKycProvider, {
      userId: data.user._id,
      documentTypes: data.documents.map((d: any) => d.document_type),
    });

    // 3. Process the KYC result via internal mutation
    await ctx.runMutation(internal.users.processKycResult, {
      userId: data.user._id,
      approved: result.approved,
      reason: result.reason,
    });

    return result;
  },
});

/**
 * Simulates a request to a 3rd party KYC provider (e.g., Smile Identity or Dojah)
 */
export const simulateKycProvider = internalAction({
  args: {
    userId: v.id("users"),
    documentTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Simulate network latency (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate an 80% approval rate
    const isApproved = Math.random() < 0.8;

    if (isApproved) {
      return { approved: true, reason: "Automatically verified by provider" };
    } else {
      const reasons = [
        "Document illegible or blurry",
        "Face mismatch with government ID",
        "ID expired or invalid",
        "Suspected fraudulent document",
      ];
      return {
        approved: false,
        reason: reasons[Math.floor(Math.random() * reasons.length)],
      };
    }
  },
});

/**
 * Internal query to fetch the authenticated user and their pending documents
 * safely for the action
 */
export const getViewerKycData = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const documents = await ctx.db
      .query("kyc_documents")
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", user._id).eq("status", "pending")
      )
      .collect();

    return { user, documents };
  },
});
