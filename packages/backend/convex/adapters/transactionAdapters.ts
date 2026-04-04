/**
 * Convex adapter factories for Transaction port interfaces.
 * Implements TransactionReadRepository and TransactionWriteRepository
 * using Convex database context.
 */
import type { Transaction } from "@avm-daily/domain";

import type { MutationCtx, QueryCtx } from "../_generated/server";

import type {
  Transaction as ConvexTransaction,
  UserSavingsPlanId,
  TransactionId,
  UserId,
} from "../types";

import type {
  TransactionWriteRepository,
  TransactionReadRepository,
} from "@avm-daily/application/ports";

import { TABLE_NAMES } from "../shared";

function docToTransaction(doc: ConvexTransaction): Transaction {
  return {
    _id: String(doc._id),
    user_id: String(doc.user_id),
    user_plan_id: doc.user_plan_id ? String(doc.user_plan_id) : undefined,
    type: doc.type,
    amount_kobo: doc.amount_kobo,
    reference: doc.reference,
    reversal_of_transaction_id: doc.reversal_of_transaction_id
      ? String(doc.reversal_of_transaction_id)
      : undefined,
    reversal_of_reference: doc.reversal_of_reference,
    reversal_of_type: doc.reversal_of_type,
    metadata:
      doc.metadata &&
      typeof doc.metadata === "object" &&
      !Array.isArray(doc.metadata)
        ? (doc.metadata as Record<string, unknown>)
        : {},
    created_at: doc.created_at,
  };
}

export function createConvexTransactionReadRepository(
  ctx: QueryCtx,
): TransactionReadRepository {
  return {
    async findByReference(reference: string): Promise<Transaction | null> {
      const docs = await ctx.db
        .query(TABLE_NAMES.TRANSACTIONS)
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .collect();
      const doc = docs[0];
      return doc ? docToTransaction(doc) : null;
    },

    async findById(id: TransactionId): Promise<Transaction | null> {
      const doc = await ctx.db.get(id);
      return doc ? docToTransaction(doc) : null;
    },

    async findByUserId(userId: UserId): Promise<Transaction[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.TRANSACTIONS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId))
        .collect();
      return docs.map(docToTransaction);
    },

    async findByReversalOfTransactionId(
      transactionId: TransactionId,
    ): Promise<Transaction[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.TRANSACTIONS)
        .withIndex("by_reversal_of_transaction_id", (q) =>
          q.eq("reversal_of_transaction_id", transactionId),
        )
        .collect();
      return docs.map(docToTransaction);
    },
  };
}

export function createConvexTransactionWriteRepository(
  ctx: MutationCtx,
): TransactionWriteRepository {
  return {
    async create(transaction: Transaction): Promise<Transaction> {
      const id = await ctx.db.insert(TABLE_NAMES.TRANSACTIONS, {
        user_id: transaction.user_id as UserId,

        user_plan_id: transaction.user_plan_id as UserSavingsPlanId,
        type: transaction.type,
        amount_kobo: transaction.amount_kobo,
        reference: transaction.reference,

        reversal_of_transaction_id:
          transaction.reversal_of_transaction_id as TransactionId,
        reversal_of_reference: transaction.reversal_of_reference,
        reversal_of_type: transaction.reversal_of_type,
        metadata: transaction.metadata,
        created_at: transaction.created_at,
      });
      const doc = await ctx.db.get(id);
      if (!doc) {
        throw new Error("Failed to create transaction");
      }
      return docToTransaction(doc);
    },

    async updateMetadata(
      id: TransactionId,
      metadata: Record<string, unknown>,
    ): Promise<void> {
      await ctx.db.patch(id, { metadata });
    },
  };
}
