/**
 * Convex adapter factory for WithdrawalRepository port interface.
 * Implements WithdrawalRepository using Convex database context.
 */
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { WithdrawalRepository } from "@avm-daily/application/ports";

import { TABLE_NAMES } from "../shared";

type AnyCtx = QueryCtx | MutationCtx;

export function createConvexWithdrawalRepository(
  ctx: AnyCtx,
): WithdrawalRepository {
  return {
    async findById(id: string): Promise<{
      _id: string;
      status: string;
      method: string;
    } | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = await ctx.db.get(id as any);
      if (!doc) return null;
      const withdrawal = doc as {
        _id: string;
        status: string;
        method?: string;
      };
      return {
        _id: String(withdrawal._id),
        status: withdrawal.status,
        method: withdrawal.method ?? "bank_transfer",
      };
    },

    async findByUserId(
      userId: string,
    ): Promise<Array<{ requested_at: number; requested_amount_kobo: bigint }>> {
      const docs = await ctx.db
        .query(TABLE_NAMES.WITHDRAWALS)
        .withIndex("by_requested_by", (q) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          q.eq("requested_by", userId as any),
        )
        .collect();

      return docs.map((doc) => ({
        requested_at: doc.requested_at,
        requested_amount_kobo: doc.requested_amount_kobo,
      }));
    },
  };
}
