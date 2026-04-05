import type {
  VerifiedBankAccountRecord,
  BankAccountRepository,
} from "@avm-daily/application/ports";

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { UserBankAccountId, UserId } from "../types";

import { TABLE_NAMES, BankAccountVerificationStatus } from "../shared";

type AnyCtx = QueryCtx | MutationCtx;

function toVerifiedBankAccountRecord(account: {
  _id: UserBankAccountId;
  bank_name: string;
  account_name?: string;
  account_number: string;
}): VerifiedBankAccountRecord {
  return {
    account_id: String(account._id),
    bank_name: account.bank_name,
    account_name: account.account_name,
    account_number_last4: account.account_number.slice(-4),
  };
}

export function createConvexBankAccountRepository(
  ctx: AnyCtx,
): BankAccountRepository {
  return {
    async findVerifiedByIdForUser(
      userId: string,
      bankAccountId: string,
    ): Promise<VerifiedBankAccountRecord | null> {
      const account = await ctx.db.get(bankAccountId as UserBankAccountId);
      if (!account || account.user_id !== (userId as UserId)) {
        return null;
      }

      if (
        account.verification_status !== BankAccountVerificationStatus.VERIFIED
      ) {
        return null;
      }

      return toVerifiedBankAccountRecord(account);
    },

    async findPrimaryVerifiedForUser(
      userId: string,
    ): Promise<VerifiedBankAccountRecord | null> {
      const accounts = await ctx.db
        .query(TABLE_NAMES.USER_BANK_ACCOUNTS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId as UserId))
        .collect();

      const account =
        accounts.find(
          (candidate) =>
            candidate.is_primary &&
            candidate.verification_status ===
              BankAccountVerificationStatus.VERIFIED,
        ) ??
        accounts.find(
          (candidate) =>
            candidate.verification_status ===
            BankAccountVerificationStatus.VERIFIED,
        );

      return account ? toVerifiedBankAccountRecord(account) : null;
    },
  };
}
