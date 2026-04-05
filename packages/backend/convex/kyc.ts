import type {
  KycDocument as ConvexKycDocument,
  User as ConvexUser,
  UserId,
} from "./types";

import type {
  KycDocument as DomainKycDocument,
  User as DomainUser,
} from "@avm-daily/domain";

import type {
  KycDocumentRepository,
  UserRepository,
} from "@avm-daily/application/ports";

import { createRunAutomatedKycUseCase } from "@avm-daily/application/use-cases";
import { v } from "convex/values";

import { action, mutation, query } from "./_generated/server";
import { KYCStatus, TABLE_NAMES } from "./shared";
import { internal } from "./_generated/api";
import { getAdminUser } from "./utils";

function toDomainUser(user: ConvexUser): DomainUser {
  return {
    _id: String(user._id),
    email: user.email,
    phone: user.phone,
    first_name: user.first_name,
    last_name: user.last_name,
    total_balance_kobo: user.total_balance_kobo,
    savings_balance_kobo: user.savings_balance_kobo,
    status: user.status,
    updated_at: user.updated_at,
  };
}

function toDomainKycDocument(document: ConvexKycDocument): DomainKycDocument {
  return {
    _id: String(document._id),
    user_id: String(document.user_id),
    document_type: document.document_type,
    file_url: document.file_url,
    storage_id: document.storage_id ? String(document.storage_id) : undefined,
    file_name: document.file_name,
    file_size: document.file_size,
    mime_type: document.mime_type,
    uploaded_at: document.uploaded_at,
    status: document.status,
    reviewed_by: document.reviewed_by
      ? String(document.reviewed_by)
      : undefined,
    reviewed_at: document.reviewed_at,
    rejection_reason: document.rejection_reason,
    supersedes_document_id: document.supersedes_document_id
      ? String(document.supersedes_document_id)
      : undefined,
    created_at: document.created_at,
  };
}

function createStaticUserRepository(user: ConvexUser): UserRepository {
  const domainUser = toDomainUser(user);

  return {
    findById: async (id) => (domainUser._id === id ? domainUser : null),
    updateBalance: async () => undefined,
    updateStatus: async () => undefined,
  };
}

function createStaticKycDocumentRepository(
  documents: ConvexKycDocument[],
): KycDocumentRepository {
  const domainDocuments = documents.map(toDomainKycDocument);

  return {
    findById: async (id) =>
      domainDocuments.find((document) => document._id === id) ?? null,
    findByUserId: async (userId) =>
      domainDocuments.filter((document) => document.user_id === userId),
    findByUserIdAndStatus: async (userId, status) =>
      domainDocuments.filter(
        (document) => document.user_id === userId && document.status === status,
      ),
    create: async () => {
      throw new Error("Not supported in action context");
    },
    update: async () => {
      throw new Error("Not supported in action context");
    },
    delete: async () => {
      throw new Error("Not supported in action context");
    },
  };
}

export const verifyIdentity = action({
  args: {},
  returns: v.object({
    approved: v.boolean(),
    reason: v.string(),
    userId: v.id("users"),
  }),
  handler: async (
    ctx,
  ): Promise<{
    approved: boolean;
    reason: string;
    userId: UserId;
  }> => {
    const data: {
      user: ConvexUser;
      documents: ConvexKycDocument[];
    } = await ctx.runQuery(internal.kycInternal.getViewerKycData);

    const runAutomatedKyc = createRunAutomatedKycUseCase({
      userRepository: createStaticUserRepository(data.user),
      kycDocumentRepository: createStaticKycDocumentRepository(data.documents),
      kycVerificationProvider: {
        verify: async (input) =>
          await ctx.runAction(internal.kycInternal.simulateKycProvider, {
            userId: data.user._id,
            documentTypes: input.documentTypes,
          }),
      },
    });

    const result = await runAutomatedKyc({
      userId: String(data.user._id),
    });

    await ctx.runMutation(internal.users.processKycResult, {
      userId: data.user._id,
      approved: result.approved,
      reason: result.reason,
      providerReference: result.providerReference,
      metadata: result.metadata,
    });

    return {
      approved: result.approved,
      reason: result.reason,
      userId: data.user._id,
    };
  },
});

export const adminListPendingKyc = query({
  args: {},
  returns: v.array(
    v.object({
      user_id: v.id("users"),
      first_name: v.string(),
      last_name: v.string(),
      email: v.optional(v.string()),
      phone: v.string(),
      status: v.string(),
      pending_documents: v.array(
        v.object({
          document_id: v.id("kyc_documents"),
          document_type: v.string(),
          created_at: v.number(),
          uploaded_at: v.optional(v.number()),
          file_name: v.optional(v.string()),
          file_size: v.optional(v.number()),
          mime_type: v.optional(v.string()),
          supersedes_document_id: v.optional(v.id("kyc_documents")),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const pendingDocs = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_status", (q) => q.eq("status", KYCStatus.PENDING))
      .collect();

    const grouped = new Map<UserId, typeof pendingDocs>();
    for (const doc of pendingDocs) {
      const current = grouped.get(doc.user_id);
      if (current) {
        current.push(doc);
      } else {
        grouped.set(doc.user_id, [doc]);
      }
    }

    const rows = [] as {
      user_id: UserId;
      first_name: string;
      last_name: string;
      email: string | undefined;
      phone: string;
      status: string;
      pending_documents: {
        document_id: (typeof pendingDocs)[number]["_id"];
        document_type: (typeof pendingDocs)[number]["document_type"];
        created_at: number;
        uploaded_at: number | undefined;
        file_name: string | undefined;
        file_size: number | undefined;
        mime_type: string | undefined;
        supersedes_document_id: (typeof pendingDocs)[number]["supersedes_document_id"];
      }[];
    }[];

    for (const [userId, docs] of grouped) {
      const user = await ctx.db.get(userId);
      if (!user) continue;

      docs.sort((a, b) => a.created_at - b.created_at);
      rows.push({
        user_id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email ?? undefined,
        phone: user.phone,
        status: user.status,
        pending_documents: docs.map((doc) => ({
          document_id: doc._id,
          document_type: doc.document_type,
          created_at: doc.created_at,
          uploaded_at: doc.uploaded_at,
          file_name: doc.file_name,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
          supersedes_document_id: doc.supersedes_document_id,
        })),
      });
    }

    rows.sort((a, b) => {
      const aOldest =
        a.pending_documents[0]?.created_at ?? Number.MAX_SAFE_INTEGER;
      const bOldest =
        b.pending_documents[0]?.created_at ?? Number.MAX_SAFE_INTEGER;
      return aOldest - bOldest;
    });

    return rows;
  },
});

export const adminReviewKyc = mutation({
  args: {
    userId: v.id("users"),
    approved: v.boolean(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    newStatus: v.string(),
    documentsReviewed: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    userId: UserId;
    newStatus: string;
    documentsReviewed: number;
  }> => {
    const admin = await getAdminUser(ctx);

    const result: {
      userId: string;
      newStatus: string;
      documentsReviewed: number;
    } = await ctx.runMutation(internal.users.processKycResult, {
      userId: args.userId,
      approved: args.approved,
      reason: args.reason,
      reviewedBy: admin._id,
    });

    return {
      userId: args.userId,
      newStatus: result.newStatus,
      documentsReviewed: result.documentsReviewed,
    };
  },
});
