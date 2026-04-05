/**
 * Convex adapter factory for WithdrawalRepository port interface.
 * Implements WithdrawalRepository using Convex database context.
 */
import type { WithdrawalRepository } from "@avm-daily/application/ports";
import type { Withdrawal as WithdrawalDomain } from "@avm-daily/domain";

import type { Withdrawal, UserId, WithdrawalId, Context } from "../types";

import {
  WithdrawalMethod as DomainWithdrawalMethod,
  DomainError,
} from "@avm-daily/domain";

import { TABLE_NAMES, WithdrawalMethod } from "../shared";
import { getInsertDb, getPatchDb } from "./utils";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMethod(method: Withdrawal["method"] | undefined) {
  return method === WithdrawalMethod.CASH
    ? DomainWithdrawalMethod.CASH
    : DomainWithdrawalMethod.BANK_TRANSFER;
}

function fallbackReference(doc: Withdrawal) {
  return doc.reference ?? `legacy_${String(doc._id)}`;
}

function docToWithdrawal(doc: Withdrawal): WithdrawalDomain {
  return {
    _id: String(doc._id),
    reference: fallbackReference(doc),
    transaction_id: doc.transaction_id ? String(doc.transaction_id) : undefined,
    reservation_id: doc.reservation_id ? String(doc.reservation_id) : undefined,
    requested_by: String(doc.requested_by),
    requested_amount_kobo: doc.requested_amount_kobo,
    method: normalizeMethod(doc.method),
    status: doc.status,
    requested_at: doc.requested_at,
    approved_at: doc.approved_at,
    approved_by: doc.approved_by ? String(doc.approved_by) : undefined,
    processed_at: doc.processed_at,
    processed_by: doc.processed_by ? String(doc.processed_by) : undefined,
    payout_provider: doc.payout_provider,
    payout_reference: doc.payout_reference,
    bank_account_details: isRecord(doc.bank_account_details)
      ? doc.bank_account_details
      : undefined,
    cash_details: isRecord(doc.cash_details) ? doc.cash_details : undefined,
    rejection_reason: doc.rejection_reason,
    last_processing_error: doc.last_processing_error,
  };
}

export function createConvexWithdrawalRepository(
  ctx: Context,
): WithdrawalRepository {
  return {
    async findById(id: WithdrawalId): Promise<WithdrawalDomain | null> {
      const withdrawal = await ctx.db.get(id);
      return withdrawal ? docToWithdrawal(withdrawal) : null;
    },

    async findByReference(reference: string): Promise<WithdrawalDomain | null> {
      const withdrawal = await ctx.db
        .query(TABLE_NAMES.WITHDRAWALS)
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .first();

      return withdrawal ? docToWithdrawal(withdrawal) : null;
    },

    async findByUserId(userId: UserId): Promise<WithdrawalDomain[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.WITHDRAWALS)
        .withIndex("by_requested_by", (q) => q.eq("requested_by", userId))
        .collect();

      return docs.map(docToWithdrawal);
    },

    async create(
      withdrawal: Omit<WithdrawalDomain, "_id">,
    ): Promise<WithdrawalDomain> {
      const insertDb = getInsertDb(
        ctx,
        "Withdrawal mutations require a mutation context",
        "withdrawal_mutation_context_required",
      );
      const id = await insertDb.insert(TABLE_NAMES.WITHDRAWALS, {
        reference: withdrawal.reference,
        requested_by: withdrawal.requested_by as Withdrawal["requested_by"],
        requested_amount_kobo: withdrawal.requested_amount_kobo,
        method: normalizeMethod(withdrawal.method),
        status: withdrawal.status,
        requested_at: withdrawal.requested_at,
        ...(withdrawal.transaction_id
          ? {
              transaction_id:
                withdrawal.transaction_id as Withdrawal["transaction_id"],
            }
          : {}),
        ...(withdrawal.reservation_id
          ? {
              reservation_id:
                withdrawal.reservation_id as Withdrawal["reservation_id"],
            }
          : {}),
        ...(withdrawal.approved_by
          ? { approved_by: withdrawal.approved_by as Withdrawal["approved_by"] }
          : {}),
        ...(withdrawal.approved_at !== undefined
          ? { approved_at: withdrawal.approved_at }
          : {}),
        ...(withdrawal.processed_by
          ? {
              processed_by:
                withdrawal.processed_by as Withdrawal["processed_by"],
            }
          : {}),
        ...(withdrawal.processed_at !== undefined
          ? { processed_at: withdrawal.processed_at }
          : {}),
        ...(withdrawal.payout_provider
          ? { payout_provider: withdrawal.payout_provider }
          : {}),
        ...(withdrawal.payout_reference
          ? { payout_reference: withdrawal.payout_reference }
          : {}),
        ...(withdrawal.bank_account_details
          ? { bank_account_details: withdrawal.bank_account_details }
          : {}),
        ...(withdrawal.cash_details
          ? { cash_details: withdrawal.cash_details }
          : {}),
        ...(withdrawal.rejection_reason
          ? { rejection_reason: withdrawal.rejection_reason }
          : {}),
        ...(withdrawal.last_processing_error
          ? { last_processing_error: withdrawal.last_processing_error }
          : {}),
      });

      const doc = await ctx.db.get(id);
      if (!doc) {
        throw new DomainError(
          "Failed to create withdrawal",
          "withdrawal_create_failed",
        );
      }

      return docToWithdrawal(doc);
    },

    async update(
      id: WithdrawalId,
      patch: Partial<
        Omit<WithdrawalDomain, "_id" | "requested_by" | "requested_at">
      >,
    ): Promise<WithdrawalDomain> {
      const existing = await ctx.db.get(id);
      if (!existing) {
        throw new DomainError("Withdrawal not found", "withdrawal_not_found");
      }

      const patchDb = getPatchDb(
        ctx,
        "Withdrawal mutations require a mutation context",
        "withdrawal_mutation_context_required",
      );
      await patchDb.patch(id, {
        ...(patch.reference !== undefined
          ? { reference: patch.reference }
          : {}),
        ...(patch.transaction_id !== undefined
          ? {
              transaction_id:
                patch.transaction_id as Withdrawal["transaction_id"],
            }
          : {}),
        ...(patch.reservation_id !== undefined
          ? {
              reservation_id:
                patch.reservation_id as Withdrawal["reservation_id"],
            }
          : {}),
        ...(patch.requested_amount_kobo !== undefined
          ? { requested_amount_kobo: patch.requested_amount_kobo }
          : {}),
        ...(patch.method !== undefined
          ? { method: normalizeMethod(patch.method) }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.approved_by !== undefined
          ? { approved_by: patch.approved_by as Withdrawal["approved_by"] }
          : {}),
        ...(patch.approved_at !== undefined
          ? { approved_at: patch.approved_at }
          : {}),
        ...(patch.processed_by !== undefined
          ? { processed_by: patch.processed_by as Withdrawal["processed_by"] }
          : {}),
        ...(patch.processed_at !== undefined
          ? { processed_at: patch.processed_at }
          : {}),
        ...(patch.payout_provider !== undefined
          ? { payout_provider: patch.payout_provider }
          : {}),
        ...(patch.payout_reference !== undefined
          ? { payout_reference: patch.payout_reference }
          : {}),
        ...(patch.bank_account_details !== undefined
          ? { bank_account_details: patch.bank_account_details }
          : {}),
        ...(patch.cash_details !== undefined
          ? { cash_details: patch.cash_details }
          : {}),
        ...(patch.rejection_reason !== undefined
          ? { rejection_reason: patch.rejection_reason }
          : {}),
        ...(patch.last_processing_error !== undefined
          ? { last_processing_error: patch.last_processing_error }
          : {}),
      });

      const updated = await ctx.db.get(id);
      if (!updated) {
        throw new DomainError("Withdrawal not found", "withdrawal_not_found");
      }

      return docToWithdrawal(updated);
    },
  };
}
