import type { WithdrawalReservation as WithdrawalReservationDomain } from "@avm-daily/domain";
import type { WithdrawalReservationRepository } from "@avm-daily/application/ports";

import type {
  WithdrawalReservationId,
  WithdrawalReservation,
  WithdrawalId,
  Context,
  UserId,
} from "../types";

import { DomainError } from "@avm-daily/domain";

import { getInsertDb, getPatchDb } from "./utils";
import { TABLE_NAMES } from "../shared";

type WithdrawalReservationPatch = Partial<
  Omit<
    WithdrawalReservationDomain,
    "_id" | "user_id" | "withdrawal_id" | "created_at"
  >
>;

function docToReservation(
  doc: WithdrawalReservation,
): WithdrawalReservationDomain {
  return {
    _id: String(doc._id),
    withdrawal_id: String(doc.withdrawal_id),
    user_id: String(doc.user_id),
    amount_kobo: doc.amount_kobo,
    reference: doc.reference,
    status: doc.status,
    created_at: doc.created_at,
    released_at: doc.released_at,
    consumed_at: doc.consumed_at,
  };
}

export function createConvexWithdrawalReservationRepository(
  ctx: Context,
): WithdrawalReservationRepository {
  return {
    async findById(
      id: WithdrawalReservationId,
    ): Promise<WithdrawalReservationDomain | null> {
      const doc = await ctx.db.get(id);
      return doc ? docToReservation(doc) : null;
    },

    async findByReference(
      reference: string,
    ): Promise<WithdrawalReservationDomain | null> {
      const doc = await ctx.db
        .query(TABLE_NAMES.WITHDRAWAL_RESERVATIONS)
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .first();

      return doc ? docToReservation(doc) : null;
    },

    async findByUserId(userId: UserId): Promise<WithdrawalReservationDomain[]> {
      const docs = await ctx.db
        .query(TABLE_NAMES.WITHDRAWAL_RESERVATIONS)
        .withIndex("by_user_id", (q) => q.eq("user_id", userId))
        .collect();

      return docs.map(docToReservation);
    },

    async create(
      reservation: Omit<WithdrawalReservationDomain, "_id">,
    ): Promise<WithdrawalReservationDomain> {
      const insertDb = getInsertDb(
        ctx,
        "Withdrawal reservation mutations require a mutation context",
        "withdrawal_reservation_mutation_context_required",
      );

      const id = await insertDb.insert(TABLE_NAMES.WITHDRAWAL_RESERVATIONS, {
        withdrawal_id: reservation.withdrawal_id as WithdrawalId,
        user_id: reservation.user_id as UserId,
        amount_kobo: reservation.amount_kobo,
        reference: reservation.reference,
        status: reservation.status,
        created_at: reservation.created_at,
        ...(reservation.released_at !== undefined
          ? { released_at: reservation.released_at }
          : {}),
        ...(reservation.consumed_at !== undefined
          ? { consumed_at: reservation.consumed_at }
          : {}),
      });

      const doc = await ctx.db.get(id);

      if (!doc) {
        throw new DomainError(
          "Failed to create withdrawal reservation",
          "withdrawal_reservation_create_failed",
        );
      }

      return docToReservation(doc);
    },

    async update(
      id: WithdrawalReservationId,
      patch: WithdrawalReservationPatch,
    ): Promise<WithdrawalReservationDomain> {
      const existing = await ctx.db.get(id);
      if (!existing) {
        throw new DomainError(
          "Withdrawal reservation not found",
          "withdrawal_reservation_not_found",
        );
      }

      const patchDb = getPatchDb(
        ctx,
        "Withdrawal reservation mutations require a mutation context",
        "withdrawal_reservation_mutation_context_required",
      );

      await patchDb.patch(id, {
        ...(patch.reference !== undefined
          ? { reference: patch.reference }
          : {}),
        ...(patch.amount_kobo !== undefined
          ? { amount_kobo: patch.amount_kobo }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.released_at !== undefined
          ? { released_at: patch.released_at }
          : {}),
        ...(patch.consumed_at !== undefined
          ? { consumed_at: patch.consumed_at }
          : {}),
      });

      const updated = await ctx.db.get(id);
      if (!updated) {
        throw new DomainError(
          "Withdrawal reservation not found",
          "withdrawal_reservation_not_found",
        );
      }

      return docToReservation(updated);
    },
  };
}
