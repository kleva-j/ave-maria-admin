import { describe, expect, it } from "vitest";

import {
  findLatestRejectedDocumentForType,
  assertWithdrawalBalanceAvailable,
  assertWithdrawalCanBeRejected,
  assertKycDocumentCanBeDeleted,
  getUserStatusForKycDecision,
  assertKycVerificationReady,
  assertKycRejectionReason,
  calculateReservedAmount,
} from "..";

import {
  WithdrawalReservationStatus,
  WithdrawalStatus,
  DocumentType,
  UserStatus,
  KycStatus,
} from "../../enums";

describe("withdrawal lifecycle domain rules", () => {
  it("sums only active reservations", () => {
    expect(
      calculateReservedAmount([
        { amount_kobo: 10_000n, status: WithdrawalReservationStatus.ACTIVE },
        { amount_kobo: 5_000n, status: WithdrawalReservationStatus.RELEASED },
        { amount_kobo: 3_000n, status: WithdrawalReservationStatus.CONSUMED },
      ]),
    ).toBe(10_000n);
  });

  it("subtracts active reservations when validating available balance", () => {
    expect(
      assertWithdrawalBalanceAvailable({
        totalBalanceKobo: 100_000n,
        savingsBalanceKobo: 100_000n,
        reservedAmountKobo: 25_000n,
        requestedAmountKobo: 70_000n,
      }),
    ).toEqual({
      availableTotalBalanceKobo: 75_000n,
      availableSavingsBalanceKobo: 75_000n,
    });

    expect(() =>
      assertWithdrawalBalanceAvailable({
        totalBalanceKobo: 100_000n,
        savingsBalanceKobo: 100_000n,
        reservedAmountKobo: 25_000n,
        requestedAmountKobo: 80_000n,
      }),
    ).toThrow("Insufficient available balance");
  });

  it("allows rejecting approved withdrawals but blocks processed ones", () => {
    expect(() =>
      assertWithdrawalCanBeRejected(WithdrawalStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertWithdrawalCanBeRejected(WithdrawalStatus.PROCESSED),
    ).toThrow("Only pending or approved withdrawals can be rejected");
  });
});

describe("kyc policy domain rules", () => {
  it("fails readiness when required documents are missing", () => {
    expect(() =>
      assertKycVerificationReady([
        {
          document_type: DocumentType.GOVERNMENT_ID,
          status: KycStatus.PENDING,
        },
      ]),
    ).toThrow("Missing required KYC documents");
  });

  it("requires an explicit rejection reason", () => {
    expect(() => assertKycRejectionReason("   ")).toThrow(
      "Rejection reason is required",
    );
    expect(assertKycRejectionReason(" Document mismatch ")).toBe(
      "Document mismatch",
    );
  });

  it("keeps rejected users in pending_kyc", () => {
    expect(getUserStatusForKycDecision(true)).toBe(UserStatus.ACTIVE);
    expect(getUserStatusForKycDecision(false)).toBe(UserStatus.PENDING_KYC);
  });

  it("retains rejected documents for supersession and blocks approved deletions", () => {
    expect(
      findLatestRejectedDocumentForType(
        [
          {
            _id: "doc-1",
            document_type: DocumentType.GOVERNMENT_ID,
            status: KycStatus.REJECTED,
            created_at: 10,
          },
          {
            _id: "doc-2",
            document_type: DocumentType.GOVERNMENT_ID,
            status: KycStatus.REJECTED,
            created_at: 20,
          },
        ],
        DocumentType.GOVERNMENT_ID,
      ),
    ).toMatchObject({ _id: "doc-2" });

    expect(() => assertKycDocumentCanBeDeleted(KycStatus.APPROVED)).toThrow(
      "Cannot delete approved documents",
    );
    expect(() =>
      assertKycDocumentCanBeDeleted(KycStatus.REJECTED),
    ).not.toThrow();
  });
});
