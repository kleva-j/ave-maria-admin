import type { KycDocumentId, StorageId } from "./types";

import {
  createDeleteKycDocumentUseCase,
  createUploadKycDocumentUseCase,
} from "@avm-daily/application/use-cases";
import { ConvexError, v } from "convex/values";

import { createConvexKycDocumentRepository } from "./adapters/kycAdapters";
import { createConvexAuditLogService } from "./adapters/auditLogAdapter";
import { createConvexUserRepository } from "./adapters/userAdapters";
import { ensureAuthedUser, getAdminUser, getUser } from "./utils";
import { mutation, query } from "./_generated/server";
import {
  bankAccountDocumentType,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DOCUMENT_TYPES,
  MAX_FILE_SIZE,
  TABLE_NAMES,
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

function validateMimeType(mimeType: string) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new ConvexError(
      `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }
}

function toConvexError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    throw new ConvexError((error as { message: string }).message);
  }

  throw error;
}

export const getUploadUrl = mutation({
  args: {
    documentType: bankAccountDocumentType,
    fileName: v.string(),
    mimeType: v.string(),
  },
  returns: v.object({ uploadUrl: v.string() }),
  handler: async (ctx, args) => {
    await ensureAuthedUser(ctx);
    validateFileName(args.fileName);
    validateMimeType(args.mimeType);

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
    supersedes_document_id: v.optional(v.id("kyc_documents")),
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
    validateMimeType(args.mimeType);

    const uploadKycDocument = createUploadKycDocumentUseCase({
      userRepository: createConvexUserRepository(ctx),
      kycDocumentRepository: createConvexKycDocumentRepository(ctx),
      auditLogService: createConvexAuditLogService(ctx),
    });

    try {
      const document = await uploadKycDocument({
        userId: String(user._id),
        documentType: args.documentType,
        storageId: String(args.storageId),
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
      });

      return {
        _id: document._id as KycDocumentId,
        document_type: document.document_type,
        status: document.status,
        file_name: document.file_name,
        file_size: document.file_size,
        mime_type: document.mime_type,
        uploaded_at: document.uploaded_at,
        supersedes_document_id: document.supersedes_document_id as
          | KycDocumentId
          | undefined,
        created_at: document.created_at,
      };
    } catch (error) {
      toConvexError(error);
    }
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
      supersedes_document_id: v.optional(v.id("kyc_documents")),
      created_at: v.number(),
    }),
  ),
  handler: async (ctx) => {
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
      supersedes_document_id: doc.supersedes_document_id,
      created_at: doc.created_at,
    }));
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id(TABLE_NAMES.KYC_DOCUMENTS) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const deleteKycDocument = createDeleteKycDocumentUseCase({
      userRepository: createConvexUserRepository(ctx),
      kycDocumentRepository: createConvexKycDocumentRepository(ctx),
      auditLogService: createConvexAuditLogService(ctx),
    });

    try {
      const deleted = await deleteKycDocument({
        userId: String(user._id),
        documentId: String(args.documentId),
      });

      if (deleted.storage_id) {
        try {
          await ctx.storage.delete(deleted.storage_id as StorageId);
        } catch (error) {
          console.error("Failed to delete KYC document storage object", {
            storage_id: deleted.storage_id,
            user_id: String(user._id),
            document_id: String(args.documentId),
            error,
          });
        }
      }

      return null;
    } catch (error) {
      toConvexError(error);
    }
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
