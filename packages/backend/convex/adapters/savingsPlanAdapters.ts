/**
 * Convex adapter factory for SavingsPlanRepository port interface.
 * Implements SavingsPlanRepository using Convex database context.
 */
import type { SavingsPlanRepository } from "@avm-daily/application/ports";
import type { UserSavingsPlan } from "@avm-daily/domain";

import type { QueryCtx, MutationCtx } from "../_generated/server";

import { TABLE_NAMES } from "../shared";

type AnyCtx = QueryCtx | MutationCtx;

function docToSavingsPlan(doc: {
  _id: string;
  user_id: string;
  current_amount_kobo: bigint;
  updated_at: number;
}): UserSavingsPlan {
  return {
    _id: String(doc._id),
    user_id: String(doc.user_id),
    current_amount_kobo: doc.current_amount_kobo,
    updated_at: doc.updated_at,
  };
}

export function createConvexSavingsPlanRepository(
  ctx: AnyCtx,
): SavingsPlanRepository {
  return {
    async findById(id: string): Promise<UserSavingsPlan | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = await ctx.db.get(id as any);
      return doc
        ? docToSavingsPlan(doc as Parameters<typeof docToSavingsPlan>[0])
        : null;
    },

    async findByUserId(userId: string): Promise<UserSavingsPlan[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.USER_SAVINGS_PLANS)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex("by_user_id", (q) => q.eq("user_id", userId as any))
        .collect();
      return docs.map(docToSavingsPlan);
    },

    async updateAmount(
      id: string,
      currentAmountKobo: bigint,
      updatedAt: number,
    ): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as MutationCtx).db.patch(id as any, {
        current_amount_kobo: currentAmountKobo,
        updated_at: updatedAt,
      });
    },
  };
}
