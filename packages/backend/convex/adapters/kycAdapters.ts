import type { KycDocumentRepository } from "@avm-daily/application/ports";
import type { KycDocument as KycDocumentDomain } from "@avm-daily/domain";

import type { KycDocument, KycDocumentId, UserId, Context } from "../types";

import { DomainError } from "@avm-daily/domain";

import { getInsertDb, getPatchDb, getDeleteDb } from "./utils";
import { TABLE_NAMES } from "../shared";

function docToKycDocument(doc: KycDocument): KycDocumentDomain {
  return {
    _id: String(doc._id),
    user_id: String(doc.user_id),
    document_type: doc.document_type,
    file_url: doc.file_url,
    storage_id: doc.storage_id ? String(doc.storage_id) : undefined,
    file_name: doc.file_name,
    file_size: doc.file_size,
    mime_type: doc.mime_type,
    uploaded_at: doc.uploaded_at,
    status: doc.status,
    reviewed_by: doc.reviewed_by ? String(doc.reviewed_by) : undefined,
    reviewed_at: doc.reviewed_at,
    rejection_reason: doc.rejection_reason,
    supersedes_document_id: doc.supersedes_document_id
      ? String(doc.supersedes_document_id)
      : undefined,
    created_at: doc.created_at,
  };
}

export function createConvexKycDocumentRepository(
  ctx: Context,
): KycDocumentRepository {
  return {
    async findById(id: KycDocumentId): Promise<KycDocumentDomain | null> {
      const doc = await ctx.db.get(id);
      return doc ? docToKycDocument(doc) : null;
    },

    async findByUserId(userId: UserId): Promise<KycDocumentDomain[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.KYC_DOCUMENTS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId))
        .collect();

      return docs.map(docToKycDocument);
    },

    async findByUserIdAndStatus(
      userId: UserId,
      status: KycDocumentDomain["status"],
    ): Promise<KycDocumentDomain[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.KYC_DOCUMENTS)
        .withIndex("by_user_id_and_status", (q) =>
          q.eq("user_id", userId).eq("status", status),
        )
        .collect();

      return docs.map(docToKycDocument);
    },

    async create(
      document: Omit<KycDocumentDomain, "_id">,
    ): Promise<KycDocumentDomain> {
      const insertDb = getInsertDb(
        ctx,
        "KYC document mutations require a mutation context",
        "kyc_document_mutation_context_required",
      );
      const id = await insertDb.insert(TABLE_NAMES.KYC_DOCUMENTS, {
        user_id: document.user_id as UserId,
        document_type: document.document_type,
        status: document.status,
        created_at: document.created_at,
        ...(document.file_url ? { file_url: document.file_url } : {}),
        ...(document.storage_id
          ? { storage_id: document.storage_id as KycDocument["storage_id"] }
          : {}),
        ...(document.file_name ? { file_name: document.file_name } : {}),
        ...(document.file_size !== undefined
          ? { file_size: document.file_size }
          : {}),
        ...(document.mime_type ? { mime_type: document.mime_type } : {}),
        ...(document.uploaded_at !== undefined
          ? { uploaded_at: document.uploaded_at }
          : {}),
        ...(document.reviewed_by
          ? { reviewed_by: document.reviewed_by as KycDocument["reviewed_by"] }
          : {}),
        ...(document.reviewed_at !== undefined
          ? { reviewed_at: document.reviewed_at }
          : {}),
        ...(document.rejection_reason
          ? { rejection_reason: document.rejection_reason }
          : {}),
        ...(document.supersedes_document_id
          ? {
              supersedes_document_id:
                document.supersedes_document_id as KycDocument["supersedes_document_id"],
            }
          : {}),
      });

      const doc = await ctx.db.get(id);

      if (!doc) {
        throw new DomainError(
          "Failed to create KYC document",
          "kyc_document_create_failed",
        );
      }

      return docToKycDocument(doc);
    },

    async update(id: KycDocumentId, patch): Promise<KycDocumentDomain> {
      const existing = await ctx.db.get(id);
      if (!existing) {
        throw new DomainError(
          "KYC document not found",
          "kyc_document_not_found",
        );
      }

      const patchDb = getPatchDb(
        ctx,
        "KYC document mutations require a mutation context",
        "kyc_document_mutation_context_required",
      );

      await patchDb.patch(id, {
        ...(patch.file_url !== undefined ? { file_url: patch.file_url } : {}),
        ...(patch.storage_id !== undefined
          ? { storage_id: patch.storage_id as KycDocument["storage_id"] }
          : {}),
        ...(patch.file_name !== undefined
          ? { file_name: patch.file_name }
          : {}),
        ...(patch.file_size !== undefined
          ? { file_size: patch.file_size }
          : {}),
        ...(patch.mime_type !== undefined
          ? { mime_type: patch.mime_type }
          : {}),
        ...(patch.uploaded_at !== undefined
          ? { uploaded_at: patch.uploaded_at }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.reviewed_by !== undefined
          ? { reviewed_by: patch.reviewed_by as KycDocument["reviewed_by"] }
          : {}),
        ...(patch.reviewed_at !== undefined
          ? { reviewed_at: patch.reviewed_at }
          : {}),
        ...(patch.rejection_reason !== undefined
          ? { rejection_reason: patch.rejection_reason }
          : {}),
        ...(patch.supersedes_document_id !== undefined
          ? {
              supersedes_document_id:
                patch.supersedes_document_id as KycDocument["supersedes_document_id"],
            }
          : {}),
      });

      const updated = await ctx.db.get(id);

      if (!updated) {
        throw new DomainError(
          "KYC document not found",
          "kyc_document_not_found",
        );
      }

      return docToKycDocument(updated);
    },

    async delete(id: KycDocumentId): Promise<void> {
      const deleteDb = getDeleteDb(
        ctx,
        "KYC document mutations require a mutation context",
        "kyc_document_mutation_context_required",
      );
      await deleteDb.delete(id);
    },
  };
}
