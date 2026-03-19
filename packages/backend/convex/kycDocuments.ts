/**
 * KYC Document Management System
 * 
 * Handles secure document upload, storage, retrieval, and lifecycle management
 * for Know Your Customer (KYC) verification. Integrates with Convex file storage
 * and implements comprehensive access controls and audit logging.
 * 
 * @module kycDocuments
 */

import { ConvexError, v } from "convex/values";

import { ensureAuthedUser, getAdminUser, getUser } from "./utils";
import { mutation, query } from "./_generated/server";
import { auditLog } from "./auditLog";
import {
  bankAccountDocumentType,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  DOCUMENT_TYPES,
  RESOURCE_TYPE,
  MAX_FILE_SIZE,
  TABLE_NAMES,
  KYCStatus,
  kycStatus,
} from "./shared";

// Required documents for KYC verification (must all be submitted)
const REQUIRED_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.GOVERNMENT_ID,
  DOCUMENT_TYPES.SELFIE_WITH_ID,
] as const;

// Optional documents for enhanced verification
const OPTIONAL_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.PROOF_OF_ADDRESS,
  DOCUMENT_TYPES.BANK_STATEMENT,
] as const;

/**
 * Validates file name has allowed extension
 * Prevents executable or dangerous file uploads
 * 
 * @param fileName - Name of file being uploaded
 * @throws ConvexError if extension not in allowed list
 */
function validateFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  const valid = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!valid) {
    throw new ConvexError(
      `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }
}

/**
 * Generates pre-signed upload URL for direct-to-storage upload
 * 
 * Workflow:
 * 1. Validate user authentication
 * 2. Validate file name and MIME type
 * 3. Generate single-use upload URL from Convex storage
 * 
 * @mutation
 * @requires User authentication
 * @param documentType - Type of document being uploaded
 * @param fileName - Original file name (validated for extension)
 * @param mimeType - File MIME type (must be in allowed list)
 * @returns Pre-signed upload URL for direct client upload
 * @throws If file type or MIME type invalid
 */
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
    // Validate user is authenticated
    await ensureAuthedUser(ctx);

    // Validate file name and MIME type before generating URL
    validateFileName(args.fileName);
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError(
        `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    // Generate pre-signed URL for direct storage upload
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

/**
 * Creates database record after successful file upload to storage
 * 
 * Workflow:
 * 1. Validate user authentication and file properties
 * 2. Check for duplicate pending document of same type
 * 3. Create KYC document record with PENDING status
 * 4. Log audit event for compliance
 * 
 * @mutation
 * @requires User authentication
 * @param documentType - Type of document being uploaded
 * @param storageId - Convex storage ID from completed upload
 * @param fileName - Original file name
 * @param fileSize - File size in bytes (validated against MAX_FILE_SIZE)
 * @param mimeType - File MIME type (must be in allowed list)
 * @returns Created document object with metadata
 * @throws If file too large, invalid type, or duplicate pending exists
 */
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
    // Get authenticated user
    const user = await getUser(ctx);

    // Validate file size (max 10MB)
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new ConvexError(
        `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Validate file properties
    validateFileName(args.fileName);
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError(
        `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    // Prevent duplicate pending documents of same type
    const existingPending = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
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

    // Create database record with PENDING status
    const now = Date.now();
    const documentId = await ctx.db.insert(TABLE_NAMES.KYC_DOCUMENTS, {
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

    // Verify document was created successfully
    const document = await ctx.db.get(documentId);
    if (!document) {
      throw new ConvexError("Failed to create KYC document");
    }

    // Log audit event for compliance tracking
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

/**
 * Generates download URL for viewing KYC documents
 * 
 * Access Control:
 * - Admin users: Can view any document
 * - Regular users: Can only view their own documents
 * - Unauthenticated: Access denied
 * 
 * @query
 * @requires User or admin authentication
 * @param documentId - ID of document to access
 * @returns Download URL string
 * @throws If not authorized, document not found, or file unavailable
 */
export const getDocumentUrl = query({
  args: { documentId: v.id("kyc_documents") },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Try to authenticate as user or admin
    const user = await getUser(ctx).catch(() => null);
    const admin = await getAdminUser(ctx).catch(() => null);

    // Require at least one authentication method
    if (!user && !admin) {
      throw new ConvexError("Not authorized to access this document");
    }

    // Get document and verify existence
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check ownership (unless admin)
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

/**
 * Lists all KYC documents for the authenticated user
 * 
 * @query
 * @requires User authentication
 * @returns Array of document summaries, sorted by most recent first
 */
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
    // Get authenticated user
    const user = await getUser(ctx);

    const docs = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
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

/**
 * Deletes a user's uploaded KYC document
 * 
 * Restrictions:
 * - User must be document owner
 * - Only PENDING or REJECTED documents can be deleted
 * - APPROVED documents require admin intervention
 * 
 * @mutation
 * @requires User authentication and ownership
 * @param documentId - ID of document to delete
 * @returns null on success
 * @throws If not authorized, document not found, or document is approved
 */
export const deleteDocument = mutation({
  args: { documentId: v.id(TABLE_NAMES.KYC_DOCUMENTS) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await getUser(ctx);
    const document = await ctx.db.get(args.documentId);

    // Verify document exists
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Verify ownership
    if (document.user_id !== user._id) {
      throw new ConvexError("Not authorized to delete this document");
    }

    // Prevent deletion of approved documents (compliance requirement)
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

/**
 * Returns KYC document requirements for UI display
 * 
 * @query
 * @returns Object containing required/optional document types and validation rules
 */
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
