/**
 * Convex adapter factory for SavingsPlanRepository port interface.
 * Implements SavingsPlanRepository using Convex database context.
 */
import type { UserSavingsPlan as UserSavingsPlanDomain } from "@avm-daily/domain";
import type { SavingsPlanRepository } from "@avm-daily/application/ports";

import type { UserId, UserSavingsPlan, UserSavingsPlanId } from "../types";
import type { QueryCtx, MutationCtx } from "../_generated/server";

import { TABLE_NAMES } from "../shared";

type AnyCtx = QueryCtx & MutationCtx;

function docToSavingsPlan(doc: UserSavingsPlan): UserSavingsPlanDomain {
  return {
    _id: doc._id,
    user_id: doc.user_id,
    current_amount_kobo: doc.current_amount_kobo,
    status: doc.status,
    updated_at: doc.updated_at,
  };
}

export function createConvexSavingsPlanRepository(
  ctx: AnyCtx,
): SavingsPlanRepository {
  return {
    async findById(
      id: UserSavingsPlanId,
    ): Promise<UserSavingsPlanDomain | null> {
      const doc = await ctx.db.get(id);
      return doc ? docToSavingsPlan(doc) : null;
    },

    async findByUserId(userId: UserId): Promise<UserSavingsPlanDomain[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.USER_SAVINGS_PLANS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId))
        .collect();
      return docs.map(docToSavingsPlan);
    },

    async updateAmount(
      id: UserSavingsPlanId,
      currentAmountKobo: bigint,
      updatedAt: number,
    ): Promise<void> {
      await ctx.db.patch(id, {
        current_amount_kobo: currentAmountKobo,
        updated_at: updatedAt,
      });
    },
  };
}
