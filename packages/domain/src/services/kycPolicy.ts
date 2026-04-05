import type { DocumentType, UserStatus } from "../enums";
import type { KycDocument } from "../entities";

import { DomainError } from "../errors";
import {
  DocumentType as DT,
  KycStatus as KS,
  UserStatus as US,
} from "../enums";

export const requiredKycDocumentTypes = [
  DT.GOVERNMENT_ID,
  DT.SELFIE_WITH_ID,
] as const satisfies readonly DocumentType[];

export const optionalKycDocumentTypes = [
  DT.PROOF_OF_ADDRESS,
  DT.BANK_STATEMENT,
] as const satisfies readonly DocumentType[];

export function assertUserCanRunKycVerification(status: UserStatus) {
  if (status !== US.PENDING_KYC) {
    throw new DomainError(
      "User is not in pending_kyc status",
      "kyc_user_not_pending",
    );
  }
}

export function getMissingRequiredKycDocuments(
  documentTypes: DocumentType[],
): DocumentType[] {
  const submittedTypes = new Set(documentTypes);
  return requiredKycDocumentTypes.filter((type) => !submittedTypes.has(type));
}

export function assertKycVerificationReady(
  documents: Pick<KycDocument, "document_type" | "status">[],
) {
  if (documents.length === 0) {
    throw new DomainError(
      "No pending KYC documents found to verify",
      "kyc_documents_missing",
    );
  }

  const pendingTypes = documents
    .filter((document) => document.status === KS.PENDING)
    .map((document) => document.document_type);
  const missingRequired = getMissingRequiredKycDocuments(pendingTypes);

  if (missingRequired.length > 0) {
    throw new DomainError(
      `Missing required KYC documents: ${missingRequired.join(", ")}`,
      "kyc_required_documents_missing",
    );
  }
}

export function assertKycRejectionReason(reason?: string) {
  if (!reason || reason.trim().length === 0) {
    throw new DomainError(
      "Rejection reason is required",
      "kyc_rejection_reason_required",
    );
  }

  return reason.trim();
}

export function getUserStatusForKycDecision(approved: boolean): UserStatus {
  return approved ? US.ACTIVE : US.PENDING_KYC;
}

export function getDocumentStatusForKycDecision(approved: boolean) {
  return approved ? KS.APPROVED : KS.REJECTED;
}

export function assertKycDocumentCanBeDeleted(status: KycDocument["status"]) {
  if (status === KS.APPROVED) {
    throw new DomainError(
      "Cannot delete approved documents. Please contact support.",
      "kyc_document_delete_forbidden",
    );
  }
}

export function findLatestRejectedDocumentForType(
  documents: Pick<KycDocument, "_id" | "document_type" | "status" | "created_at">[],
  documentType: DocumentType,
) {
  return documents
    .filter(
      (document) =>
        document.document_type === documentType && document.status === KS.REJECTED,
    )
    .sort((a, b) => b.created_at - a.created_at)[0];
}
