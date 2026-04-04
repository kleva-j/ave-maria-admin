/**
 * Convex adapter factory for UserRepository port interface.
 * Implements UserRepository using Convex database context.
 */
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { UserRepository } from "@avm-daily/application/ports";
import type { User } from "@avm-daily/domain";

import { TABLE_NAMES } from "../shared";

type AnyCtx = QueryCtx | MutationCtx;

function docToUser(doc: {
  _id: string;
  email?: string;
  phone: string;
  total_balance_kobo: bigint;
  savings_balance_kobo: bigint;
  updated_at: number;
}): User {
  return {
    _id: String(doc._id),
    email: doc.email ?? "",
    phone: doc.phone,
    total_balance_kobo: doc.total_balance_kobo,
    savings_balance_kobo: doc.savings_balance_kobo,
    updated_at: doc.updated_at,
  };
}

export function createConvexUserRepository(ctx: AnyCtx): UserRepository {
  return {
    async findById(id: string): Promise<User | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = await ctx.db.get(id as any);
      return doc ? docToUser(doc as Parameters<typeof docToUser>[0]) : null;
    },

    async updateBalance(
      id: string,
      totalBalanceKobo: bigint,
      savingsBalanceKobo: bigint,
      updatedAt: number,
    ): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as MutationCtx).db.patch(id as any, {
        total_balance_kobo: totalBalanceKobo,
        savings_balance_kobo: savingsBalanceKobo,
        updated_at: updatedAt,
      });
    },
  };
}
