import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { ensureAuthedUser, getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";
import {
  bankAccountDocumentType,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  DOCUMENT_TYPES,
  RESOURCE_TYPE,
  MAX_FILE_SIZE,
  KYCStatus,
  kycStatus,
} from "./shared";

const REQUIRED_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.GOVERNMENT_ID,
  DOCUMENT_TYPES.SELFIE_WITH_ID,
] as const;

const OPTIONAL_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.PROOF_OF_ADDRESS,
  DOCUMENT_TYPES.BANK_STATEMENT,
] as const;

function validateFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  const valid = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!valid) {
    throw new ConvexError(
      `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }
}

export const getUploadUrl = mutation({
  args: {
    documentType: bankAccountDocumentType,
    fileName: v.string(),
    mimeType: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    await ensureAuthedUser(ctx);

    validateFileName(args.fileName);
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError(
        `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const uploadDocument = mutation({
  args: {
    documentType: bankAccountDocumentType,
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  returns: v.object({
    _id: v.id("kyc_documents"),
    document_type: bankAccountDocumentType,
    status: kycStatus,
    file_name: v.optional(v.string()),
    file_size: v.optional(v.number()),
    mime_type: v.optional(v.string()),
    uploaded_at: v.optional(v.number()),
    created_at: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    if (args.fileSize > MAX_FILE_SIZE) {
      throw new ConvexError(
        `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    validateFileName(args.fileName);
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError(
        `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    const existingPending = await ctx.db
      .query("kyc_documents")
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", user._id).eq("status", KYCStatus.PENDING),
      )
      .filter((q) => q.eq(q.field("document_type"), args.documentType))
      .first();

    if (existingPending) {
      throw new ConvexError(
        `A pending ${args.documentType} document already exists`,
      );
    }

    const now = Date.now();
    const documentId = await ctx.db.insert("kyc_documents", {
      user_id: user._id,
      document_type: args.documentType,
      storage_id: args.storageId,
      file_name: args.fileName,
      file_size: args.fileSize,
      mime_type: args.mimeType,
      uploaded_at: now,
      status: KYCStatus.PENDING,
      created_at: now,
    });

    const document = await ctx.db.get(documentId);
    if (!document) {
      throw new ConvexError("Failed to create KYC document");
    }

    await auditLog.log(ctx, {
      action: "kyc.document_uploaded",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.KYC_DOCUMENTS,
      resourceId: document._id,
      severity: "info",
      metadata: {
        document_type: args.documentType,
        file_name: args.fileName,
        file_size: args.fileSize,
        mime_type: args.mimeType,
      },
    });

    return {
      _id: document._id,
      document_type: document.document_type,
      status: document.status,
      file_name: document.file_name,
      file_size: document.file_size,
      mime_type: document.mime_type,
      uploaded_at: document.uploaded_at,
      created_at: document.created_at,
    };
  },
});

export const getDocumentUrl = query({
  args: { documentId: v.id("kyc_documents") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await getUser(ctx).catch(() => null);
    const admin = await getAdminUser(ctx).catch(() => null);

    if (!user && !admin) {
      throw new ConvexError("Not authorized to access this document");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (!admin && user && document.user_id !== user._id) {
      throw new ConvexError("Not authorized to access this document");
    }

    if (document.storage_id) {
      const url = await ctx.storage.getUrl(document.storage_id);
      if (!url) {
        throw new ConvexError("Failed to generate document URL");
      }
      return url;
    }

    if (document.file_url) {
      return document.file_url;
    }

    throw new ConvexError("No file available for this document");
  },
});

export const listMyDocuments = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("kyc_documents"),
      document_type: bankAccountDocumentType,
      status: kycStatus,
      file_name: v.optional(v.string()),
      file_size: v.optional(v.number()),
      mime_type: v.optional(v.string()),
      uploaded_at: v.optional(v.number()),
      reviewed_by: v.optional(v.id("admin_users")),
      reviewed_at: v.optional(v.number()),
      rejection_reason: v.optional(v.string()),
      created_at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const docs = await ctx.db
      .query("kyc_documents")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    docs.sort((a, b) => b.created_at - a.created_at);

    return docs.map((doc) => ({
      _id: doc._id,
      document_type: doc.document_type,
      status: doc.status,
      file_name: doc.file_name,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      uploaded_at: doc.uploaded_at,
      reviewed_by: doc.reviewed_by,
      reviewed_at: doc.reviewed_at,
      rejection_reason: doc.rejection_reason,
      created_at: doc.created_at,
    }));
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("kyc_documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (document.user_id !== user._id) {
      throw new ConvexError("Not authorized to delete this document");
    }

    if (document.status === KYCStatus.APPROVED) {
      throw new ConvexError(
        "Cannot delete approved documents. Please contact support.",
      );
    }

    if (document.storage_id) {
      await ctx.storage.delete(document.storage_id);
    }

    await ctx.db.delete(document._id);

    await auditLog.log(ctx, {
      action: "kyc.document_deleted",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.KYC_DOCUMENTS,
      resourceId: document._id,
      severity: "warning",
      metadata: {
        document_type: document.document_type,
        file_name: document.file_name,
        previous_status: document.status,
      },
    });

    return null;
  },
});

export const getKycRequirements = query({
  args: {},
  returns: v.object({
    required: v.array(bankAccountDocumentType),
    optional: v.array(bankAccountDocumentType),
    maxFileSize: v.number(),
    allowedMimeTypes: v.array(v.string()),
  }),
  handler: async () => {
    return {
      required: [...REQUIRED_KYC_DOCUMENTS],
      optional: [...OPTIONAL_KYC_DOCUMENTS],
      maxFileSize: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    };
  },
});
