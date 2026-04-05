/**
 * Convex adapter factory for UserRepository port interface.
 * Implements UserRepository using Convex database context.
 */
import type { UserRepository } from "@avm-daily/application/ports";
import type { User as UserDomain } from "@avm-daily/domain";

import type { User, UserId, Context } from "../types";

import { getPatchDb } from "./utils";

function docToUser(doc: User): UserDomain {
  return {
    _id: String(doc._id),
    email: doc.email ?? "",
    phone: doc.phone,
    first_name: doc.first_name,
    last_name: doc.last_name,
    status: doc.status,
    total_balance_kobo: doc.total_balance_kobo,
    savings_balance_kobo: doc.savings_balance_kobo,
    updated_at: doc.updated_at,
  };
}

export function createConvexUserRepository(ctx: Context): UserRepository {
  return {
    async findById(id: UserId): Promise<UserDomain | null> {
      const doc = await ctx.db.get(id);
      return doc ? docToUser(doc) : null;
    },

    async updateBalance(
      id: UserId,
      totalBalanceKobo: bigint,
      savingsBalanceKobo: bigint,
      updatedAt: number,
    ): Promise<void> {
      const patchDb = getPatchDb(
        ctx,
        "User mutations require a mutation context",
        "user_mutation_context_required",
      );
      await patchDb.patch(id, {
        total_balance_kobo: totalBalanceKobo,
        savings_balance_kobo: savingsBalanceKobo,
        updated_at: updatedAt,
      });
    },

    async updateStatus(
      id: UserId,
      status: UserDomain["status"],
      updatedAt: number,
    ): Promise<void> {
      const patchDb = getPatchDb(
        ctx,
        "User mutations require a mutation context",
        "user_mutation_context_required",
      );
      await patchDb.patch(id, {
        status,
        updated_at: updatedAt,
      });
    },
  };
}
