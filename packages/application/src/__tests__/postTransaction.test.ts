import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { createPostTransactionUseCase } from "../use-cases/index.js";

import type {
  TransactionReadRepository,
  TransactionWriteRepository,
  SavingsPlanRepository,
  UserRepository,
} from "../ports/index.js";

import type { Transaction, User, UserSavingsPlan } from "@avm-daily/domain";
import type { PostTransactionDTO } from "../dto/index.js";
import {
  InsufficientBalanceError,
  DuplicateReferenceError,
  TransactionSource,
  DomainError,
  TxnType,
} from "@avm-daily/domain";

// --- Arbitrary generators ---

const arbitraryUserId = fc.uuid();
const arbitraryUserPlanId = fc.uuid();
const arbitraryReversalTransactionId = fc.uuid();
const arbitraryReference = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);
const arbitraryAmountKobo = fc.bigInt({ min: 1n, max: 10_000_000n });
const arbitraryTxnType = fc.constantFrom<
  (typeof TxnType)[keyof typeof TxnType]
>(
  TxnType.CONTRIBUTION,
  TxnType.INTEREST_ACCRUAL,
  TxnType.REFERRAL_BONUS,
  TxnType.INVESTMENT_YIELD,
  TxnType.WITHDRAWAL,
  TxnType.REVERSAL,
);
const arbitraryPositiveTxnType = fc.constantFrom<
  (typeof TxnType)[keyof typeof TxnType]
>(
  TxnType.CONTRIBUTION,
  TxnType.INTEREST_ACCRUAL,
  TxnType.REFERRAL_BONUS,
  TxnType.INVESTMENT_YIELD,
);

const arbitraryPostTransactionInput = fc.record({
  userId: arbitraryUserId,
  userPlanId: fc.option(arbitraryUserPlanId, { nil: undefined }),
  reference: arbitraryReference,
  amountKobo: arbitraryAmountKobo,
  type: arbitraryPositiveTxnType,
  reversalOfTransactionId: fc.option(arbitraryReversalTransactionId, {
    nil: undefined,
  }),
  reversalOfReference: fc.option(arbitraryReference, { nil: undefined }),
  reversalOfType: fc.option(arbitraryTxnType, { nil: undefined }),
  source: fc.constantFrom<
    (typeof TransactionSource)[keyof typeof TransactionSource]
  >(TransactionSource.USER, TransactionSource.ADMIN, TransactionSource.SYSTEM),
  metadata: fc.option(
    fc.dictionary(fc.string({ minLength: 1, maxLength: 16 }), fc.string()),
    {
      nil: undefined,
    },
  ),
});

// --- In-memory mock implementations ---

function makeInMemoryDeps(user: User, plan?: UserSavingsPlan) {
  // In-memory transaction store
  const transactions: Transaction[] = [];
  let idCounter = 0;

  const transactionReadRepository: TransactionReadRepository = {
    findByReference: async (ref) =>
      transactions.find((t) => t.reference === ref) ?? null,
    findById: async (id) => transactions.find((t) => t._id === id) ?? null,
    findByUserId: async (uid) => transactions.filter((t) => t.user_id === uid),
    findByReversalOfTransactionId: async (txnId) =>
      transactions.filter((t) => t.reversal_of_transaction_id === txnId),
  };

  const transactionWriteRepository: TransactionWriteRepository = {
    create: async (tx) => {
      const newTx: Transaction = { ...tx, _id: `tx-${++idCounter}` };
      transactions.push(newTx);
      return newTx;
    },
    updateMetadata: async () => undefined,
  };

  // Mutable user balance
  let currentUser: User = { ...user };

  const userRepository: UserRepository = {
    findById: async (id) =>
      id === currentUser._id ? { ...currentUser } : null,
    updateBalance: async (id, totalBalanceKobo, savingsBalanceKobo) => {
      if (id !== currentUser._id) {
        throw new Error(
          `Unexpected user balance update for ${id}; expected ${currentUser._id}`,
        );
      }

      currentUser = {
        ...currentUser,
        total_balance_kobo: totalBalanceKobo,
        savings_balance_kobo: savingsBalanceKobo,
      };
    },
  };

  // Mutable plan amount
  let currentPlan: UserSavingsPlan | undefined = plan ? { ...plan } : undefined;

  const savingsPlanRepository: SavingsPlanRepository = {
    findById: async (id) =>
      currentPlan && currentPlan._id === id ? { ...currentPlan } : null,
    findByUserId: async (uid) =>
      currentPlan && currentPlan.user_id === uid ? [{ ...currentPlan }] : [],
    findByUserIdAndTemplateId: async (uid, templateId) =>
      currentPlan &&
      currentPlan.user_id === uid &&
      currentPlan.template_id === templateId
        ? { ...currentPlan }
        : null,
    create: async (plan) => {
      currentPlan = { ...plan, _id: `plan-${Date.now()}` };
      return { ...currentPlan };
    },
    update: async (id, patch) => {
      if (!currentPlan || currentPlan._id !== id) {
        throw new Error(
          `Unexpected savings plan update for ${id}; expected ${currentPlan?._id ?? "none"}`,
        );
      }

      currentPlan = {
        ...currentPlan,
        ...patch,
      };

      return { ...currentPlan };
    },
    updateAmount: async (id, currentAmountKobo, updatedAt) => {
      if (!currentPlan) {
        throw new Error(
          `Unexpected savings plan update for ${id}; no current plan seeded`,
        );
      }

      if (currentPlan._id !== id) {
        throw new Error(
          `Unexpected savings plan update for ${id}; expected ${currentPlan._id}`,
        );
      }

      currentPlan = {
        ...currentPlan,
        current_amount_kobo: currentAmountKobo,
        updated_at: updatedAt,
      };
    },
  };

  return {
    transactionReadRepository,
    transactionWriteRepository,
    userRepository,
    savingsPlanRepository,
    getTransactions: () => [...transactions],
    getUser: () => ({ ...currentUser }),
    getPlan: () => (currentPlan ? { ...currentPlan } : undefined),
  };
}

function makeUser(userId: string): User {
  return {
    _id: userId,
    email: "test@example.com",
    phone: "+2348000000000",
    total_balance_kobo: 0n,
    savings_balance_kobo: 0n,
    status: "active",
    updated_at: Date.now(),
  };
}

function makePlan(userId: string, planId: string): UserSavingsPlan {
  return {
    _id: planId,
    user_id: userId,
    template_id: "template-1",
    custom_target_kobo: 100_000n,
    current_amount_kobo: 0n,
    start_date: "2026-04-04",
    end_date: "2026-05-04",
    status: "active",
    automation_enabled: false,
    metadata: {},
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

function makeDepsForInput(input: PostTransactionDTO) {
  const user = makeUser(input.userId);
  const plan = input.userPlanId
    ? makePlan(input.userId, input.userPlanId)
    : undefined;

  return makeInMemoryDeps(user, plan);
}

// --- Property 8: Post transaction idempotency ---

describe("Property 8: Post transaction idempotency", () => {
  it("posting the same transaction twice returns idempotent: true on the second call and does not create a duplicate record", async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPostTransactionInput, async (rawInput) => {
        const input: PostTransactionDTO = {
          ...rawInput,
          userId: rawInput.userId,
        };

        const deps = makeDepsForInput(input);
        const postTransaction = createPostTransactionUseCase(deps);

        // First call — should succeed and create a record
        const first = await postTransaction(input);
        expect(first.idempotent).toBe(false);

        const afterFirstTransactions = deps.getTransactions();
        const afterFirstUser = deps.getUser();
        const afterFirstPlan = deps.getPlan();
        expect(afterFirstTransactions).toHaveLength(1);

        // Second call with identical payload — should be idempotent
        const second = await postTransaction(input);
        expect(second.idempotent).toBe(true);

        // No second record should be created
        const afterSecondTransactions = deps.getTransactions();
        expect(afterSecondTransactions).toHaveLength(1);
        expect(afterSecondTransactions).toEqual(afterFirstTransactions);
        expect(deps.getUser()).toEqual(afterFirstUser);
        expect(deps.getPlan()).toEqual(afterFirstPlan);

        // The returned transaction should be the same record
        expect(second.transaction._id).toBe(first.transaction._id);
        expect(second.transaction.reference).toBe(input.reference);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 9: Post transaction conflict detection ---

describe("Property 9: Post transaction conflict detection", () => {
  it("posting the same reference with a different amount throws DuplicateReferenceError", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPostTransactionInput,
        // A different amount that is guaranteed to differ from the first
        fc.bigInt({ min: 10_000_001n, max: 20_000_000n }),
        async (rawInput, differentAmount) => {
          const input: PostTransactionDTO = { ...rawInput };

          const deps = makeDepsForInput(input);
          const postTransaction = createPostTransactionUseCase(deps);

          // First call — establishes the reference
          await postTransaction(input);
          const afterFirstTransactions = deps.getTransactions();
          const afterFirstUser = deps.getUser();
          const afterFirstPlan = deps.getPlan();

          // Second call — same reference, different amount
          const conflictingInput: PostTransactionDTO = {
            ...input,
            amountKobo: differentAmount,
          };

          await expect(postTransaction(conflictingInput)).rejects.toThrow(
            DuplicateReferenceError,
          );
          expect(deps.getTransactions()).toEqual(afterFirstTransactions);
          expect(deps.getUser()).toEqual(afterFirstUser);
          expect(deps.getPlan()).toEqual(afterFirstPlan);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("posting the same reference with a different type throws DuplicateReferenceError", async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPostTransactionInput, async (rawInput) => {
        // Pick a type that differs from the input type
        const allPositiveTypes = [
          TxnType.CONTRIBUTION,
          TxnType.INTEREST_ACCRUAL,
          TxnType.REFERRAL_BONUS,
          TxnType.INVESTMENT_YIELD,
        ] as const;
        const differentType = allPositiveTypes.find((t) => t !== rawInput.type);
        fc.pre(Boolean(differentType));

        const input: PostTransactionDTO = { ...rawInput };
        const deps = makeDepsForInput(input);
        const postTransaction = createPostTransactionUseCase(deps);

        // First call — establishes the reference
        await postTransaction(input);
        const afterFirstTransactions = deps.getTransactions();
        const afterFirstUser = deps.getUser();
        const afterFirstPlan = deps.getPlan();

        // Second call — same reference, different type
        const conflictingInput: PostTransactionDTO = {
          ...input,
          type: differentType!,
        };

        await expect(postTransaction(conflictingInput)).rejects.toThrow(
          DuplicateReferenceError,
        );
        expect(deps.getTransactions()).toEqual(afterFirstTransactions);
        expect(deps.getUser()).toEqual(afterFirstUser);
        expect(deps.getPlan()).toEqual(afterFirstPlan);
      }),
      { numRuns: 100 },
    );
  });

  it("the thrown error is a DomainError instance with code 'duplicate_reference'", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPostTransactionInput,
        fc.bigInt({ min: 10_000_001n, max: 20_000_000n }),
        async (rawInput, differentAmount) => {
          const input: PostTransactionDTO = { ...rawInput };
          const deps = makeDepsForInput(input);
          const postTransaction = createPostTransactionUseCase(deps);

          await postTransaction(input);
          const afterFirstTransactions = deps.getTransactions();
          const afterFirstUser = deps.getUser();
          const afterFirstPlan = deps.getPlan();

          const conflictingInput: PostTransactionDTO = {
            ...input,
            amountKobo: differentAmount,
          };

          let caught: unknown;
          try {
            await postTransaction(conflictingInput);
          } catch (err) {
            caught = err;
          }

          expect(caught).toBeInstanceOf(DomainError);
          expect(caught).toBeInstanceOf(DuplicateReferenceError);
          expect((caught as DuplicateReferenceError).code).toBe(
            "duplicate_reference",
          );
          expect(deps.getTransactions()).toEqual(afterFirstTransactions);
          expect(deps.getUser()).toEqual(afterFirstUser);
          expect(deps.getPlan()).toEqual(afterFirstPlan);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Post transaction reversal audit fields", () => {
  it("treats reversal audit fields as part of duplicate-reference comparison", async () => {
    const userId = "user-reversal-audit";
    const user = {
      ...makeUser(userId),
      total_balance_kobo: 1_000n,
      savings_balance_kobo: 1_000n,
    };
    const deps = makeInMemoryDeps(user);
    const postTransaction = createPostTransactionUseCase(deps);

    await postTransaction({
      userId,
      type: TxnType.REVERSAL,
      amountKobo: -1_000n,
      reference: "reversal-audit-ref",
      reversalOfTransactionId: "tx-original",
      reversalOfReference: "original-ref",
      reversalOfType: TxnType.CONTRIBUTION,
      metadata: { original_type: TxnType.CONTRIBUTION },
      source: TransactionSource.ADMIN,
    });
    const afterFirstTransactions = deps.getTransactions();
    const afterFirstUser = deps.getUser();
    const afterFirstPlan = deps.getPlan();

    await expect(
      postTransaction({
        userId,
        type: TxnType.REVERSAL,
        amountKobo: -1_000n,
        reference: "reversal-audit-ref",
        reversalOfTransactionId: "tx-original",
        reversalOfReference: "different-original-ref",
        reversalOfType: TxnType.CONTRIBUTION,
        metadata: { original_type: TxnType.CONTRIBUTION },
        source: TransactionSource.ADMIN,
      }),
    ).rejects.toThrow(DuplicateReferenceError);
    expect(deps.getTransactions()).toEqual(afterFirstTransactions);
    expect(deps.getUser()).toEqual(afterFirstUser);
    expect(deps.getPlan()).toEqual(afterFirstPlan);
  });
});

describe("Post transaction balance guards", () => {
  it("rejects projected user balances that would go negative", async () => {
    const userId = "user-negative-balance";
    const user = {
      ...makeUser(userId),
      total_balance_kobo: 500n,
      savings_balance_kobo: 500n,
    };
    const deps = makeInMemoryDeps(user);
    const postTransaction = createPostTransactionUseCase(deps);

    let caught: unknown;
    try {
      await postTransaction({
        userId,
        type: TxnType.WITHDRAWAL,
        amountKobo: -600n,
        reference: "withdrawal-negative-balance",
        source: TransactionSource.USER,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InsufficientBalanceError);
    expect((caught as Error).message).toContain(
      "Projected total balance would go negative",
    );
    expect(deps.getTransactions()).toHaveLength(0);
    expect(deps.getUser().total_balance_kobo).toBe(500n);
    expect(deps.getUser().savings_balance_kobo).toBe(500n);
  });

  it("rejects projected plan balances that would go negative", async () => {
    const userId = "user-negative-plan";
    const planId = "plan-negative-balance";
    const user = {
      ...makeUser(userId),
      total_balance_kobo: 1_000n,
      savings_balance_kobo: 1_000n,
    };
    const plan = {
      ...makePlan(userId, planId),
      current_amount_kobo: 400n,
    };
    const deps = makeInMemoryDeps(user, plan);
    const postTransaction = createPostTransactionUseCase(deps);

    let caught: unknown;
    try {
      await postTransaction({
        userId,
        userPlanId: planId,
        type: TxnType.WITHDRAWAL,
        amountKobo: -500n,
        reference: "withdrawal-negative-plan",
        source: TransactionSource.USER,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InsufficientBalanceError);
    expect((caught as Error).message).toContain(
      "Projected plan amount would go negative",
    );
    expect(deps.getTransactions()).toHaveLength(0);
    expect(deps.getUser().total_balance_kobo).toBe(1_000n);
    expect(deps.getUser().savings_balance_kobo).toBe(1_000n);
    expect(deps.getPlan()?.current_amount_kobo).toBe(400n);
  });
});
