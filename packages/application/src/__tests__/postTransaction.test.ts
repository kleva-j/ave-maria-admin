import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { createPostTransactionUseCase } from "../use-cases/index.js";

import type {
  TransactionReadRepository,
  TransactionWriteRepository,
  UserRepository,
  SavingsPlanRepository,
} from "../ports/index.js";

import type { PostTransactionDTO } from "../dto/index.js";
import type { Transaction, User, UserSavingsPlan } from "@avm-daily/domain";
import { TxnType, TransactionSource, DuplicateReferenceError, DomainError } from "@avm-daily/domain";

// Feature: clean-architecture-refactor, Property 8: Post transaction idempotency

// --- Arbitrary generators ---

const arbitraryUserId = fc.uuid();
const arbitraryReference = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);
const arbitraryAmountKobo = fc.bigInt({ min: 1n, max: 10_000_000n });
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
  reference: arbitraryReference,
  amountKobo: arbitraryAmountKobo,
  type: arbitraryPositiveTxnType,
  source: fc.constantFrom<
    (typeof TransactionSource)[keyof typeof TransactionSource]
  >(TransactionSource.USER, TransactionSource.ADMIN, TransactionSource.SYSTEM),
  metadata: fc.option(
    fc.dictionary(fc.string({ minLength: 1, maxLength: 16 }), fc.string()),
    { nil: undefined },
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
      if (id === currentUser._id) {
        currentUser = {
          ...currentUser,
          total_balance_kobo: totalBalanceKobo,
          savings_balance_kobo: savingsBalanceKobo,
        };
      }
    },
  };

  // Mutable plan amount
  let currentPlan: UserSavingsPlan | undefined = plan ? { ...plan } : undefined;

  const savingsPlanRepository: SavingsPlanRepository = {
    findById: async (id) =>
      currentPlan && currentPlan._id === id ? { ...currentPlan } : null,
    findByUserId: async (uid) =>
      currentPlan && currentPlan.user_id === uid ? [{ ...currentPlan }] : [],
    updateAmount: async (id, currentAmountKobo) => {
      if (currentPlan && currentPlan._id === id) {
        currentPlan = {
          ...currentPlan,
          current_amount_kobo: currentAmountKobo,
        };
      }
    },
  };

  return {
    transactionReadRepository,
    transactionWriteRepository,
    userRepository,
    savingsPlanRepository,
    getTransactions: () => [...transactions],
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

// --- Property 8: Post transaction idempotency ---

describe("Property 8: Post transaction idempotency", () => {
  it("posting the same transaction twice returns idempotent: true on the second call and does not create a duplicate record", async () => {
    // Feature: clean-architecture-refactor, Property 8: Post transaction idempotency
    await fc.assert(
      fc.asyncProperty(arbitraryPostTransactionInput, async (rawInput) => {
        const input: PostTransactionDTO = {
          ...rawInput,
          userId: rawInput.userId,
        };

        const user = makeUser(input.userId);
        const deps = makeInMemoryDeps(user);
        const postTransaction = createPostTransactionUseCase(deps);

        // First call — should succeed and create a record
        const first = await postTransaction(input);
        expect(first.idempotent).toBe(false);

        const afterFirst = deps.getTransactions();
        expect(afterFirst).toHaveLength(1);

        // Second call with identical payload — should be idempotent
        const second = await postTransaction(input);
        expect(second.idempotent).toBe(true);

        // No second record should be created
        const afterSecond = deps.getTransactions();
        expect(afterSecond).toHaveLength(1);

        // The returned transaction should be the same record
        expect(second.transaction.id).toBe(first.transaction.id);
        expect(second.transaction.reference).toBe(input.reference);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 9: Post transaction conflict detection ---

describe("Property 9: Post transaction conflict detection", () => {
  it("posting the same reference with a different amount throws DuplicateReferenceError", async () => {
    // Feature: clean-architecture-refactor, Property 9: Post transaction conflict detection
    await fc.assert(
      fc.asyncProperty(
        arbitraryPostTransactionInput,
        // A different amount that is guaranteed to differ from the first
        fc.bigInt({ min: 10_000_001n, max: 20_000_000n }),
        async (rawInput, differentAmount) => {
          const input: PostTransactionDTO = { ...rawInput };

          const user = makeUser(input.userId);
          const deps = makeInMemoryDeps(user);
          const postTransaction = createPostTransactionUseCase(deps);

          // First call — establishes the reference
          await postTransaction(input);

          // Second call — same reference, different amount
          const conflictingInput: PostTransactionDTO = {
            ...input,
            amountKobo: differentAmount,
          };

          await expect(postTransaction(conflictingInput)).rejects.toThrow(
            DuplicateReferenceError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("posting the same reference with a different type throws DuplicateReferenceError", async () => {
    // Feature: clean-architecture-refactor, Property 9: Post transaction conflict detection
    await fc.assert(
      fc.asyncProperty(
        arbitraryPostTransactionInput,
        async (rawInput) => {
          // Pick a type that differs from the input type
          const allPositiveTypes = [
            TxnType.CONTRIBUTION,
            TxnType.INTEREST_ACCRUAL,
            TxnType.REFERRAL_BONUS,
            TxnType.INVESTMENT_YIELD,
          ] as const;
          const differentType = allPositiveTypes.find(
            (t) => t !== rawInput.type,
          );
          // If all types are the same (shouldn't happen with 4 options), skip
          if (!differentType) return;

          const input: PostTransactionDTO = { ...rawInput };
          const user = makeUser(input.userId);
          const deps = makeInMemoryDeps(user);
          const postTransaction = createPostTransactionUseCase(deps);

          // First call — establishes the reference
          await postTransaction(input);

          // Second call — same reference, different type
          const conflictingInput: PostTransactionDTO = {
            ...input,
            type: differentType,
          };

          await expect(postTransaction(conflictingInput)).rejects.toThrow(
            DuplicateReferenceError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("the thrown error is a DomainError instance with code 'duplicate_reference'", async () => {
    // Feature: clean-architecture-refactor, Property 9: Post transaction conflict detection
    await fc.assert(
      fc.asyncProperty(
        arbitraryPostTransactionInput,
        fc.bigInt({ min: 10_000_001n, max: 20_000_000n }),
        async (rawInput, differentAmount) => {
          const input: PostTransactionDTO = { ...rawInput };
          const user = makeUser(input.userId);
          const deps = makeInMemoryDeps(user);
          const postTransaction = createPostTransactionUseCase(deps);

          await postTransaction(input);

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
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 16: Use-case errors are DomainError instances ---

describe("Property 16: Use-case errors are DomainError instances", () => {
  it("duplicate reference with different payload throws an instance of DomainError (specifically DuplicateReferenceError)", async () => {
    // Feature: clean-architecture-refactor, Property 16: Use-case errors are DomainError instances
    await fc.assert(
      fc.asyncProperty(
        arbitraryPostTransactionInput,
        // Generate a different amount guaranteed to differ from the first (which is max 10_000_000n)
        fc.bigInt({ min: 10_000_001n, max: 20_000_000n }),
        async (rawInput, differentAmount) => {
          const input: PostTransactionDTO = { ...rawInput };
          const user = makeUser(input.userId);
          const deps = makeInMemoryDeps(user);
          const postTransaction = createPostTransactionUseCase(deps);

          // First call — establishes the reference
          await postTransaction(input);

          // Second call — same reference, different amount (conflict)
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

          // The error MUST be a DomainError subclass, not a plain Error
          expect(caught).toBeInstanceOf(DomainError);
          expect(caught).toBeInstanceOf(DuplicateReferenceError);
          expect((caught as DomainError).code).toBe("duplicate_reference");
        },
      ),
      { numRuns: 100 },
    );
  });
});
