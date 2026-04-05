import { v } from "convex/values";

import { internalAction, internalQuery } from "./_generated/server";
import { KYCStatus, TABLE_NAMES } from "./shared";
import { getUser } from "./utils";

export const simulateKycProvider = internalAction({
  args: {
    userId: v.id("users"),
    documentTypes: v.array(v.string()),
  },
  returns: v.object({
    approved: v.boolean(),
    reason: v.string(),
    providerReference: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }),
  handler: async (_ctx, args) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const approved = Math.random() < 0.8;
    const providerReference = `kyc_${String(args.userId)}_${Date.now()}`;

    if (approved) {
      return {
        approved: true,
        reason: "Automatically verified by provider",
        providerReference,
        metadata: {
          document_count: args.documentTypes.length,
        },
      };
    }

    const reasons = [
      "Document illegible or blurry",
      "Face mismatch with government ID",
      "ID expired or invalid",
      "Suspected fraudulent document",
    ];

    return {
      approved: false,
      reason:
        reasons[Math.floor(Math.random() * reasons.length)] ??
        "KYC verification failed",
      providerReference,
      metadata: {
        document_count: args.documentTypes.length,
      },
    };
  },
});

export const getViewerKycData = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const documents = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", user._id).eq("status", KYCStatus.PENDING),
      )
      .collect();

    return { user, documents };
  },
});
