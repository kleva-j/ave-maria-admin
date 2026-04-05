import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AuditLogService,
  BankAccountRepository,
  KycDocumentRepository,
  UserRepository,
  VerifiedBankAccountRecord,
  WithdrawalPayoutService,
  WithdrawalRepository,
  WithdrawalReservationRepository,
} from "../ports/index.js";
import type { KycDocument, Transaction, User, Withdrawal, WithdrawalReservation } from "@avm-daily/domain";

import {
  createApplyKycDecisionUseCase,
  createDeleteKycDocumentUseCase,
  createProcessWithdrawalUseCase,
  createRejectWithdrawalUseCase,
  createRequestWithdrawalUseCase,
  createRunAutomatedKycUseCase,
  createUploadKycDocumentUseCase,
} from "../use-cases/index.js";
import { DomainError, DocumentType, KycStatus, TransactionSource, TxnType, WithdrawalMethod, WithdrawalReservationStatus, WithdrawalStatus } from "@avm-daily/domain";

function createUser(overrides: Partial<User> = {}): User {
  return {
    _id: "user-1",
    email: "user@example.com",
    phone: "+2348000000000",
    first_name: "Ada",
    last_name: "Lovelace",
    total_balance_kobo: 100_000n,
    savings_balance_kobo: 100_000n,
    status: "active",
    updated_at: 1,
    ...overrides,
  };
}

function createWithdrawal(overrides: Partial<Withdrawal> = {}): Withdrawal {
  return {
    _id: "withdrawal-1",
    reference: "wdr_1",
    requested_by: "user-1",
    requested_amount_kobo: 25_000n,
    method: WithdrawalMethod.BANK_TRANSFER,
    status: WithdrawalStatus.PENDING,
    requested_at: 1,
    bank_account_details: {
      account_id: "bank-1",
      bank_name: "Test Bank",
      account_name: "Ada Lovelace",
      account_number_last4: "1234",
    },
    ...overrides,
  };
}

function createReservation(
  overrides: Partial<WithdrawalReservation> = {},
): WithdrawalReservation {
  return {
    _id: "reservation-1",
    withdrawal_id: "withdrawal-1",
    user_id: "user-1",
    amount_kobo: 25_000n,
    reference: "wres_wdr_1",
    status: WithdrawalReservationStatus.ACTIVE,
    created_at: 1,
    ...overrides,
  };
}

function createKycDocument(
  overrides: Partial<KycDocument> = {},
): KycDocument {
  return {
    _id: "doc-1",
    user_id: "user-1",
    document_type: DocumentType.GOVERNMENT_ID,
    status: KycStatus.PENDING,
    created_at: 1,
    ...overrides,
  };
}

function createUserRepository(users: User[]): UserRepository {
  const store = new Map(users.map((user) => [user._id, { ...user }]));

  return {
    findById: async (id) => {
      const user = store.get(id);
      return user ? { ...user } : null;
    },
    updateBalance: async (id, totalBalanceKobo, savingsBalanceKobo, updatedAt) => {
      const user = store.get(id);
      if (!user) throw new Error(`Unknown user: ${id}`);
      store.set(id, {
        ...user,
        total_balance_kobo: totalBalanceKobo,
        savings_balance_kobo: savingsBalanceKobo,
        updated_at: updatedAt,
      });
    },
    updateStatus: async (id, status, updatedAt) => {
      const user = store.get(id);
      if (!user) throw new Error(`Unknown user: ${id}`);
      store.set(id, {
        ...user,
        status,
        updated_at: updatedAt,
      });
    },
  };
}

function createWithdrawalRepository(
  withdrawals: Withdrawal[] = [],
): WithdrawalRepository & { get: (id: string) => Withdrawal | undefined } {
  const store = new Map(withdrawals.map((withdrawal) => [withdrawal._id, { ...withdrawal }]));
  let counter = withdrawals.length;

  return {
    get: (id) => {
      const withdrawal = store.get(id);
      return withdrawal ? { ...withdrawal } : undefined;
    },
    findById: async (id) => {
      const withdrawal = store.get(id);
      return withdrawal ? { ...withdrawal } : null;
    },
    findByReference: async (reference) => {
      const withdrawal = [...store.values()].find((item) => item.reference === reference);
      return withdrawal ? { ...withdrawal } : null;
    },
    findByUserId: async (userId) =>
      [...store.values()]
        .filter((withdrawal) => withdrawal.requested_by === userId)
        .map((withdrawal) => ({ ...withdrawal })),
    create: async (withdrawal) => {
      const created = { ...withdrawal, _id: `withdrawal-${++counter}` };
      store.set(created._id, created);
      return { ...created };
    },
    update: async (id, patch) => {
      const withdrawal = store.get(id);
      if (!withdrawal) throw new Error(`Unknown withdrawal: ${id}`);
      const updated = { ...withdrawal, ...patch };
      store.set(id, updated);
      return { ...updated };
    },
  };
}

function createReservationRepository(
  reservations: WithdrawalReservation[] = [],
): WithdrawalReservationRepository & {
  get: (id: string) => WithdrawalReservation | undefined;
} {
  const store = new Map(
    reservations.map((reservation) => [reservation._id, { ...reservation }]),
  );
  let counter = reservations.length;

  return {
    get: (id) => {
      const reservation = store.get(id);
      return reservation ? { ...reservation } : undefined;
    },
    findById: async (id) => {
      const reservation = store.get(id);
      return reservation ? { ...reservation } : null;
    },
    findByReference: async (reference) => {
      const reservation = [...store.values()].find(
        (item) => item.reference === reference,
      );
      return reservation ? { ...reservation } : null;
    },
    findByUserId: async (userId) =>
      [...store.values()]
        .filter((reservation) => reservation.user_id === userId)
        .map((reservation) => ({ ...reservation })),
    create: async (reservation) => {
      const created = { ...reservation, _id: `reservation-${++counter}` };
      store.set(created._id, created);
      return { ...created };
    },
    update: async (id, patch) => {
      const reservation = store.get(id);
      if (!reservation) throw new Error(`Unknown reservation: ${id}`);
      const updated = { ...reservation, ...patch };
      store.set(id, updated);
      return { ...updated };
    },
  };
}

function createBankAccountRepository(
  account?: VerifiedBankAccountRecord,
): BankAccountRepository {
  return {
    findVerifiedByIdForUser: async () => account ?? null,
    findPrimaryVerifiedForUser: async () => account ?? null,
  };
}

function createKycDocumentRepository(
  documents: KycDocument[] = [],
): KycDocumentRepository & { get: (id: string) => KycDocument | undefined } {
  const store = new Map(documents.map((document) => [document._id, { ...document }]));
  let counter = documents.length;

  return {
    get: (id) => {
      const document = store.get(id);
      return document ? { ...document } : undefined;
    },
    findById: async (id) => {
      const document = store.get(id);
      return document ? { ...document } : null;
    },
    findByUserId: async (userId) =>
      [...store.values()]
        .filter((document) => document.user_id === userId)
        .map((document) => ({ ...document })),
    findByUserIdAndStatus: async (userId, status) =>
      [...store.values()]
        .filter(
          (document) =>
            document.user_id === userId && document.status === status,
        )
        .map((document) => ({ ...document })),
    create: async (document) => {
      const created = { ...document, _id: `doc-${++counter}` };
      store.set(created._id, created);
      return { ...created };
    },
    update: async (id, patch) => {
      const document = store.get(id);
      if (!document) throw new Error(`Unknown document: ${id}`);
      const updated = { ...document, ...patch };
      store.set(id, updated);
      return { ...updated };
    },
    delete: async (id) => {
      store.delete(id);
    },
  };
}

function createAuditLogService(): AuditLogService {
  return {
    log: vi.fn(async () => undefined),
    logChange: vi.fn(async () => undefined),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withdrawal application use cases", () => {
  it("creates a withdrawal reservation without posting a ledger transaction", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const auditLogService = createAuditLogService();
    const withdrawalRepository = createWithdrawalRepository();
    const reservationRepository = createReservationRepository();
    const assertWithdrawalAllowed = vi.fn(async () => undefined);

    const requestWithdrawal = createRequestWithdrawalUseCase({
      userRepository: createUserRepository([createUser()]),
      withdrawalRepository,
      withdrawalReservationRepository: reservationRepository,
      bankAccountRepository: createBankAccountRepository({
        account_id: "bank-1",
        bank_name: "Test Bank",
        account_name: "Ada Lovelace",
        account_number_last4: "1234",
      }),
      auditLogService,
      assertWithdrawalAllowed,
    });

    const result = await requestWithdrawal({
      userId: "user-1",
      amountKobo: 25_000n,
      method: WithdrawalMethod.BANK_TRANSFER,
      bankAccountId: "bank-1",
      reference: "wdr_manual_1",
    });

    expect(result.withdrawal.transaction_id).toBeUndefined();
    expect(result.withdrawal.reservation_id).toBe(result.reservation._id);
    expect(result.reservation.status).toBe(WithdrawalReservationStatus.ACTIVE);
    expect(assertWithdrawalAllowed).toHaveBeenCalledOnce();
    expect(auditLogService.log).toHaveBeenCalledOnce();
  });

  it("rejects an approved withdrawal by releasing the reservation only", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    const auditLogService = createAuditLogService();
    const withdrawalRepository = createWithdrawalRepository([
      createWithdrawal({
        status: WithdrawalStatus.APPROVED,
        reservation_id: "reservation-1",
      }),
    ]);
    const reservationRepository = createReservationRepository([
      createReservation(),
    ]);

    const rejectWithdrawal = createRejectWithdrawalUseCase({
      withdrawalRepository,
      withdrawalReservationRepository: reservationRepository,
      auditLogService,
      assertAdminActionAllowed: vi.fn(async () => undefined),
    });

    const result = await rejectWithdrawal({
      withdrawalId: "withdrawal-1",
      adminId: "admin-1",
      adminRole: "finance",
      reason: "Manual review failure",
    });

    expect(result.withdrawal.status).toBe(WithdrawalStatus.REJECTED);
    expect(result.withdrawal.transaction_id).toBeUndefined();
    expect(result.reservation.status).toBe(WithdrawalReservationStatus.RELEASED);
    expect(auditLogService.logChange).toHaveBeenCalledOnce();
  });

  it("processes an approved withdrawal by posting the ledger transaction and consuming the reservation", async () => {
    vi.spyOn(Date, "now").mockReturnValue(30_000);
    const auditLogService = createAuditLogService();
    const payoutService: WithdrawalPayoutService = {
      execute: vi.fn(async () => ({
        provider: "manual_ops",
        reference: "payout_1",
      })),
    };
    const postTransaction = vi.fn(
      async (): Promise<{ transaction: Transaction; idempotent: boolean }> => ({
        idempotent: false,
        transaction: {
          _id: "tx-1",
          user_id: "user-1",
          type: TxnType.WITHDRAWAL,
          amount_kobo: -25_000n,
          reference: "wdr_1",
          metadata: {},
          created_at: 30_000,
        },
      }),
    );

    const processWithdrawal = createProcessWithdrawalUseCase({
      withdrawalRepository: createWithdrawalRepository([
        createWithdrawal({
          status: WithdrawalStatus.APPROVED,
          reservation_id: "reservation-1",
        }),
      ]),
      withdrawalReservationRepository: createReservationRepository([
        createReservation(),
      ]),
      payoutService,
      postTransaction,
      auditLogService,
      assertAdminActionAllowed: vi.fn(async () => undefined),
    });

    const result = await processWithdrawal({
      withdrawalId: "withdrawal-1",
      adminId: "admin-1",
      adminRole: "finance",
    });

    expect(payoutService.execute).toHaveBeenCalledOnce();
    expect(postTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: TxnType.WITHDRAWAL,
        amountKobo: -25_000n,
        source: TransactionSource.ADMIN,
      }),
    );
    expect(result.withdrawal.status).toBe(WithdrawalStatus.PROCESSED);
    expect(result.withdrawal.transaction_id).toBe("tx-1");
    expect(result.reservation.status).toBe(WithdrawalReservationStatus.CONSUMED);
  });
});

describe("kyc application use cases", () => {
  it("uploads a replacement document by superseding the latest rejected document", async () => {
    vi.spyOn(Date, "now").mockReturnValue(40_000);
    const auditLogService = createAuditLogService();
    const uploadKycDocument = createUploadKycDocumentUseCase({
      userRepository: createUserRepository([
        createUser({ status: "pending_kyc" }),
      ]),
      kycDocumentRepository: createKycDocumentRepository([
        createKycDocument({
          _id: "doc-old",
          status: KycStatus.REJECTED,
          created_at: 20_000,
        }),
      ]),
      auditLogService,
    });

    const document = await uploadKycDocument({
      userId: "user-1",
      documentType: DocumentType.GOVERNMENT_ID,
      storageId: "storage-1",
      fileName: "id.png",
      fileSize: 1024,
      mimeType: "image/png",
    });

    expect(document.status).toBe(KycStatus.PENDING);
    expect(document.supersedes_document_id).toBe("doc-old");
  });

  it("rejects deleting approved KYC documents and deletes pending ones", async () => {
    const auditLogService = createAuditLogService();
    const repo = createKycDocumentRepository([
      createKycDocument({
        _id: "doc-approved",
        status: KycStatus.APPROVED,
      }),
      createKycDocument({
        _id: "doc-pending",
        document_type: DocumentType.SELFIE_WITH_ID,
      }),
    ]);

    const deleteKycDocument = createDeleteKycDocumentUseCase({
      userRepository: createUserRepository([
        createUser({ status: "pending_kyc" }),
      ]),
      kycDocumentRepository: repo,
      auditLogService,
    });

    await expect(
      deleteKycDocument({
        userId: "user-1",
        documentId: "doc-approved",
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const deleted = await deleteKycDocument({
      userId: "user-1",
      documentId: "doc-pending",
    });

    expect(deleted._id).toBe("doc-pending");
    expect(repo.get("doc-pending")).toBeUndefined();
  });

  it("runs automated KYC only when required pending documents exist", async () => {
    const verify = vi.fn(async () => ({
      approved: false,
      reason: "Face mismatch",
      providerReference: "kyc-run-1",
      metadata: { score: 0.2 },
    }));

    const runAutomatedKyc = createRunAutomatedKycUseCase({
      userRepository: createUserRepository([
        createUser({ status: "pending_kyc" }),
      ]),
      kycDocumentRepository: createKycDocumentRepository([
        createKycDocument(),
        createKycDocument({
          _id: "doc-2",
          document_type: DocumentType.SELFIE_WITH_ID,
        }),
      ]),
      kycVerificationProvider: { verify },
    });

    const result = await runAutomatedKyc({ userId: "user-1" });

    expect(verify).toHaveBeenCalledOnce();
    expect(result.approved).toBe(false);
    expect(result.documents).toHaveLength(2);
  });

  it("applies KYC rejection by keeping the user in pending_kyc and updating all pending documents", async () => {
    vi.spyOn(Date, "now").mockReturnValue(50_000);
    const auditLogService = createAuditLogService();
    const userRepository = createUserRepository([
      createUser({ status: "pending_kyc" }),
    ]);
    const kycDocumentRepository = createKycDocumentRepository([
      createKycDocument(),
      createKycDocument({
        _id: "doc-2",
        document_type: DocumentType.SELFIE_WITH_ID,
      }),
    ]);

    const applyKycDecision = createApplyKycDecisionUseCase({
      userRepository,
      kycDocumentRepository,
      auditLogService,
    });

    const result = await applyKycDecision({
      userId: "user-1",
      approved: false,
      reason: "Document mismatch",
      reviewedBy: "admin-1",
    });

    expect(result.newStatus).toBe("pending_kyc");
    expect(result.documentsReviewed).toBe(2);
    expect(await kycDocumentRepository.findByUserIdAndStatus("user-1", KycStatus.REJECTED)).toHaveLength(2);
    expect(auditLogService.logChange).toHaveBeenCalledOnce();
  });
});
