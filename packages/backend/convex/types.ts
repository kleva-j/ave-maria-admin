import type { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";

export type Context = QueryCtx | MutationCtx;

// Users
export type AdminUserId = Id<"admin_users">;
export type AdminUser = Doc<"admin_users">;
export type UserId = Id<"users">;
export type User = Doc<"users">;

// KYC
export type KycDocument = Doc<"kyc_documents">;
export type KycData = {
  user: User;
  documents: KycDocument[];
};

// Bank Accounts
export type UserBankAccount = Doc<"user_bank_accounts">;
export type UserBankAccountId = Id<"user_bank_accounts">;

export type UserBankAccountEvent = Doc<"user_bank_account_events">;
export type UserBankAccountEventId = Id<"user_bank_account_events">;

export type BankAccountDocument = Doc<"bank_account_documents">;
export type BankAccountDocumentId = Id<"bank_account_documents">;

// Storage
export type StorageId = Id<"_storage">;
