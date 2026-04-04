/**
 * Convex adapter factory for WithdrawalRepository port interface.
 * Implements WithdrawalRepository using Convex database context.
 */
import type { WithdrawalRepository } from "@avm-daily/application/ports";

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { UserId, WithdrawalId } from "../types";
import type { WithdrawalStatus } from "../shared";

import { TABLE_NAMES, WithdrawalMethod } from "../shared";

type AnyCtx = QueryCtx | MutationCtx;

type FindByIdReturnType = Promise<{
  _id: WithdrawalId;
  status: WithdrawalStatus;
  method: WithdrawalMethod;
} | null>;

type FindByUserIdReturnType = Promise<
  Array<{ requested_at: number; requested_amount_kobo: bigint }>
>;

export function createConvexWithdrawalRepository(
  ctx: AnyCtx,
): WithdrawalRepository {
  return {
    async findById(id: WithdrawalId): FindByIdReturnType {
      const withdrawal = await ctx.db.get(id);
      if (!withdrawal) return null;
      return {
        _id: withdrawal._id,
        status: withdrawal.status,
        method: withdrawal.method ?? WithdrawalMethod.CASH,
      };
    },

    async findByUserId(userId: UserId): FindByUserIdReturnType {
      const docs = await ctx.db
        .query(TABLE_NAMES.WITHDRAWALS)
        .withIndex("by_requested_by", (q) => q.eq("requested_by", userId))
        .collect();

      return docs.map((doc) => ({
        requested_at: doc.requested_at,
        requested_amount_kobo: doc.requested_amount_kobo,
      }));
    },
  };
}
