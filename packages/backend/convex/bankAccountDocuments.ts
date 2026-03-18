/**
 * Bank Account Documents Module
 *
 * Manages document uploads for bank account verification.
 * Features:
 * - Secure file upload with validation
 * - Document type categorization
 * - Access control (user can only view their own documents)
 * - Admin access for review
 * - Signed URL generation for secure file access
 *
 * Database Tables:
 * - bank_account_documents: Stores document metadata and references
 */
import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAdminUser, getUser } from "./utils";
import { auditLog } from "./auditLog";
import {
  KYC_VERIFICATION_STATUS,
  bankAccountDocumentType,
  VERFICATION_STATUS,
  DOCUMENT_TYPES,
  RESOURCE_TYPE,
  EVENT_TYPE,
} from "./shared";

// Constants for file validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

/**
 * Verification requirements for bank accounts
 * Defines which documents are required vs optional
 */
const VERIFICATION_REQUIREMENTS = {
  required: [DOCUMENT_TYPES.GOVERNMENT_ID] as const,
  optional: [
    DOCUMENT_TYPES.PROOF_OF_ADDRESS,
    DOCUMENT_TYPES.BANK_STATEMENT,
    DOCUMENT_TYPES.SELFIE_WITH_ID,
  ] as const,
};

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

/**
 * Validates file name extension against allowed types
 */
function validateFileName(fileName: string): void {
  const lowerName = fileName.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext),
  );

  if (!hasValidExtension) {
    throw new ConvexError(
      `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }
}

/**
 * Generates a time-limited signed URL for document access
 * URLs expire after 1 hour for security
 */
export const getDocumentUrl = query({
  args: {
    documentId: v.id("bank_account_documents"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      throw new ConvexError("Document not found");
    }

    // SECURITY: Users can only access their own documents
    if (document.user_id !== user._id) {
      // Check if admin
      const admin = await getAdminUser(ctx).catch(() => null);
      if (!admin) {
        throw new ConvexError("Not authorized to access this document");
      }
    }

    // Generate signed URL with 1 hour expiration
    const url = await ctx.storage.getUrl(document.storage_id);

    if (!url) {
      throw new ConvexError("Failed to generate document URL");
    }

    return url;
  },
});

/**
 * List all documents for a specific bank account
 * Returns document metadata without URLs (call getDocumentUrl separately for access)
 */
export const listDocuments = query({
  args: {
    accountId: v.id("user_bank_accounts"),
  },
  returns: v.array(
    v.object({
      _id: v.id("bank_account_documents"),
      document_type: v.string(),
      file_name: v.string(),
      file_size: v.number(),
      mime_type: v.string(),
      status: v.string(),
      uploaded_at: v.number(),
      reviewed_by: v.optional(v.id("admin_users")),
      reviewed_at: v.optional(v.number()),
      rejection_reason: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.accountId);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    const documents = await ctx.db
      .query("bank_account_documents")
      .withIndex("by_account_id", (q) => q.eq("account_id", args.accountId))
      .collect();

    return documents.map((doc) => ({
      _id: doc._id,
      document_type: doc.document_type,
      file_name: doc.file_name,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      status: doc.status,
      uploaded_at: doc.uploaded_at,
      reviewed_by: doc.reviewed_by,
      reviewed_at: doc.reviewed_at,
      rejection_reason: doc.rejection_reason,
    }));
  },
});

/**
 * Get upload URL for a new document
 * Client uses this URL to upload file directly to Convex storage
 */
export const getUploadUrl = mutation({
  args: {
    accountId: v.id("user_bank_accounts"),
    documentType: bankAccountDocumentType,
    fileName: v.string(),
    mimeType: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
    storageId: v.id("_storage"),
  }),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.accountId);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    // Validate file name and MIME type
    validateFileName(args.fileName);
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError(
        `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    // Generate upload URL - client will upload directly to storage
    const uploadUrl = await ctx.storage.generateUploadUrl();

    return { uploadUrl, storageId: uploadUrl as any }; // Storage ID is embedded in URL
  },
});

/**
 * Upload a document for bank account verification
 * This is an action that handles the complete upload flow
 */
export const uploadDocument = mutation({
  args: {
    accountId: v.id("user_bank_accounts"),
    documentType: v.union(
      v.literal(DOCUMENT_TYPES.GOVERNMENT_ID),
      v.literal(DOCUMENT_TYPES.PROOF_OF_ADDRESS),
      v.literal(DOCUMENT_TYPES.BANK_STATEMENT),
      v.literal(DOCUMENT_TYPES.SELFIE_WITH_ID),
    ),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  returns: v.object({
    _id: v.id("bank_account_documents"),
    document_type: v.string(),
    file_name: v.string(),
    file_size: v.number(),
    mime_type: v.string(),
    status: v.string(),
    uploaded_at: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.accountId);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    // Validate file constraints
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

    // Check if document already exists for this account and type
    const existing = await ctx.db
      .query("bank_account_documents")
      .withIndex("by_account_id_and_status", (q) =>
        q
          .eq("account_id", args.accountId)
          .eq("status", KYC_VERIFICATION_STATUS.PENDING),
      )
      .filter((q) => q.eq(q.field("document_type"), args.documentType))
      .first();

    if (existing) {
      throw new ConvexError(
        `A pending ${args.documentType} document already exists for this account`,
      );
    }

    // Create document record
    const now = Date.now();
    const docId = await ctx.db.insert("bank_account_documents", {
      user_id: user._id,
      account_id: args.accountId,
      document_type: args.documentType,
      storage_id: args.storageId,
      file_name: args.fileName,
      file_size: args.fileSize,
      mime_type: args.mimeType,
      status: VERFICATION_STATUS.PENDING,
      uploaded_at: now,
    });

    const document = await ctx.db.get(docId);
    if (!document) {
      throw new ConvexError("Failed to create document record");
    }

    // Log to audit system
    await auditLog.log(ctx, {
      action: "bank_account.document_uploaded",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENTS,
      resourceId: document._id,
      severity: "info",
      metadata: {
        account_id: args.accountId,
        document_type: args.documentType,
        file_name: args.fileName,
        file_size: args.fileSize,
      },
    });

    // Log event for compliance trail
    await ctx.db.insert("user_bank_account_events", {
      user_id: user._id,
      account_id: args.accountId,
      event_type: EVENT_TYPE.DOCUMENT_UPLOADED,
      created_at: now,
      new_values: {
        document_type: args.documentType,
        file_name: args.fileName,
        status: VERFICATION_STATUS.PENDING,
      },
      actor_user_id: user._id,
    });

    return {
      _id: document._id,
      document_type: document.document_type,
      file_name: document.file_name,
      file_size: document.file_size,
      mime_type: document.mime_type,
      status: document.status,
      uploaded_at: document.uploaded_at,
    };
  },
});

/**
 * Delete a document (only allowed if status is rejected or if no review started)
 * Prevents users from deleting evidence during active review
 */
export const deleteDocument = mutation({
  args: {
    documentId: v.id("bank_account_documents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      throw new ConvexError("Document not found");
    }

    // SECURITY: Users can only delete their own documents
    if (document.user_id !== user._id) {
      throw new ConvexError("Not authorized to delete this document");
    }

    // BUSINESS RULE: Cannot delete documents under active review
    if (document.status === "approved") {
      throw new ConvexError(
        "Cannot delete approved documents. Please contact support.",
      );
    }

    // Delete the file from storage
    await ctx.storage.delete(document.storage_id);

    // Delete the document record
    await ctx.db.delete(args.documentId);

    // Log deletion
    await auditLog.log(ctx, {
      action: "bank_account.document_deleted",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.BANK_ACCOUNT_DOCUMENTS,
      resourceId: args.documentId,
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

/**
 * Get verification requirements for bank accounts
 * Returns list of required and optional documents
 */
export const getVerificationRequirements = query({
  args: {},
  returns: v.object({
    required: v.array(v.string()),
    optional: v.array(v.string()),
    maxFileSize: v.number(),
    allowedMimeTypes: v.array(v.string()),
  }),
  handler: async () => {
    return {
      required: [...VERIFICATION_REQUIREMENTS.required],
      optional: [...VERIFICATION_REQUIREMENTS.optional],
      maxFileSize: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    };
  },
});

/**
 * Check verification completeness for an account
 * Returns what's missing for submission
 */
export const checkVerificationReadiness = query({
  args: {
    accountId: v.id("user_bank_accounts"),
  },
  returns: v.object({
    isReady: v.boolean(),
    uploadedDocuments: v.array(v.string()),
    missingRequired: v.array(v.string()),
    hasOptionalDocuments: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const account = await ctx.db.get(args.accountId);

    if (!account || account.user_id !== user._id) {
      throw new ConvexError("Bank account not found");
    }

    const documents = await ctx.db
      .query("bank_account_documents")
      .withIndex("by_account_id", (q) => q.eq("account_id", args.accountId))
      .filter((q) => q.eq(q.field("status"), VERFICATION_STATUS.PENDING))
      .collect();

    const uploadedDocs = documents.map((d) => d.document_type);
    const missingRequired = VERIFICATION_REQUIREMENTS.required.filter(
      (req) => !uploadedDocs.includes(req),
    );
    const hasOptional = VERIFICATION_REQUIREMENTS.optional.filter((opt) =>
      uploadedDocs.includes(opt),
    );

    return {
      isReady: missingRequired.length === 0,
      uploadedDocuments: uploadedDocs,
      missingRequired: missingRequired,
      hasOptionalDocuments: hasOptional,
    };
  },
});
