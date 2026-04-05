import type { WithdrawalReservation, Withdrawal } from "../entities";
import type { WithdrawalMethod, WithdrawalStatus } from "../enums";

import { DomainError } from "../errors";
import {
  WithdrawalReservationStatus as WRS,
  WithdrawalMethod as WM,
  WithdrawalStatus as WS,
} from "../enums";

export function normalizeWithdrawalMethod(
  method?: WithdrawalMethod,
): WithdrawalMethod {
  return method ?? WM.BANK_TRANSFER;
}

export function assertPositiveWithdrawalAmount(amountKobo: bigint) {
  if (amountKobo <= 0n) {
    throw new DomainError(
      "Withdrawal amount must be greater than zero",
      "invalid_withdrawal_amount",
    );
  }
}

export function calculateReservedAmount(
  reservations: Pick<WithdrawalReservation, "amount_kobo" | "status">[],
) {
  return reservations.reduce((sum, reservation) => {
    return reservation.status === WRS.ACTIVE
      ? sum + reservation.amount_kobo
      : sum;
  }, 0n);
}

export function assertWithdrawalBalanceAvailable(input: {
  totalBalanceKobo: bigint;
  savingsBalanceKobo: bigint;
  reservedAmountKobo: bigint;
  requestedAmountKobo: bigint;
}) {
  const availableTotal = input.totalBalanceKobo - input.reservedAmountKobo;
  const availableSavings = input.savingsBalanceKobo - input.reservedAmountKobo;

  if (
    availableTotal < input.requestedAmountKobo ||
    availableSavings < input.requestedAmountKobo
  ) {
    throw new DomainError(
      "Insufficient available balance",
      "insufficient_balance",
    );
  }

  return {
    availableTotalBalanceKobo: availableTotal,
    availableSavingsBalanceKobo: availableSavings,
  };
}

export function assertWithdrawalCanBeApproved(status: WithdrawalStatus) {
  if (status !== WS.PENDING) {
    throw new DomainError(
      "Only pending withdrawals can be approved",
      "withdrawal_approve_invalid_status",
    );
  }
}

export function assertWithdrawalCanBeRejected(status: WithdrawalStatus) {
  if (status !== WS.PENDING && status !== WS.APPROVED) {
    throw new DomainError(
      "Only pending or approved withdrawals can be rejected",
      "withdrawal_reject_invalid_status",
    );
  }
}

export function assertWithdrawalCanBeProcessed(status: WithdrawalStatus) {
  if (status !== WS.APPROVED) {
    throw new DomainError(
      "Only approved withdrawals can be processed",
      "withdrawal_process_invalid_status",
    );
  }
}

export function assertReservationIsActive(
  reservation: Pick<WithdrawalReservation, "status">,
) {
  if (reservation.status !== WRS.ACTIVE) {
    throw new DomainError(
      "Withdrawal reservation is no longer active",
      "withdrawal_reservation_not_active",
    );
  }
}

export function isWithdrawalAwaitingSettlement(
  withdrawal: Pick<Withdrawal, "status">,
) {
  return withdrawal.status === WS.PENDING || withdrawal.status === WS.APPROVED;
}
