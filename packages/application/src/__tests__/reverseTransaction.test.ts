import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { createReverseTransactionUseCase } from "../use-cases/index.js";

import type {
  TransactionReadRepository,
  TransactionWriteRepository,
  SavingsPlanRepository,
  UserRepository,
} from "../ports/index.js";

import type { Transaction, User } from "@avm-daily/domain";

import type { ReverseTransactionDTO } from "../dto/index.js";

import { TxnType, TransactionSource, DomainError } from "@avm-daily/domain";

// --- Arbitrary generators ---

const arbitraryUserId = fc.uuid();
const arbitraryReference = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);
const arbitraryReverseReference = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);

// --- In-memory mock implementations ---

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

function makeInMemoryDeps(user: User, seedTransactions: Transaction[] = []) {
  const transactions: Transaction[] = [...seedTransactions];
  let idCounter = seedTransactions.length;

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

  const savingsPlanRepository: SavingsPlanRepository = {
    findById: async () => null,
    findByUserId: async () => [],
    updateAmount: async () => undefined,
  };

  return {
    transactionReadRepository,
    transactionWriteRepository,
    userRepository,
    savingsPlanRepository,
    getTransactions: () => [...transactions],
  };
}

// --- Property 10: Reverse transaction rejects reversals of reversals ---

describe("Property 10: Reverse transaction rejects reversals of reversals", () => {
  it("throws a DomainError when attempting to reverse a REVERSAL transaction", async () => {

    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryReference,
        arbitraryReverseReference,
        async (userId, originalRef, reverseRef) => {
          fc.pre(originalRef !== reverseRef);

          const user = makeUser(userId);

          // Seed a REVERSAL transaction directly into the store
          const reversalTx: Transaction = {
            _id: "tx-reversal-seed",
            user_id: userId,
            type: TxnType.REVERSAL,
            amount_kobo: -1000n,
            reference: originalRef,
            metadata: {},
            created_at: Date.now(),
          };

          const deps = makeInMemoryDeps(user, [reversalTx]);
          const reverseTransaction = createReverseTransactionUseCase(deps);

          const input: ReverseTransactionDTO = {
            originalTransactionId: "tx-reversal-seed",
            reference: reverseRef,
            reason: "test reversal of reversal",
            source: TransactionSource.ADMIN,
          };

          await expect(reverseTransaction(input)).rejects.toThrow(DomainError);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("the thrown error is an instance of DomainError (not a plain Error)", async () => {

    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryReference,
        arbitraryReverseReference,
        async (userId, originalRef, reverseRef) => {
          fc.pre(originalRef !== reverseRef);

          const user = makeUser(userId);

          const reversalTx: Transaction = {
            _id: "tx-reversal-seed",
            user_id: userId,
            type: TxnType.REVERSAL,
            amount_kobo: -500n,
            reference: originalRef,
            metadata: {},
            created_at: Date.now(),
          };

          const deps = makeInMemoryDeps(user, [reversalTx]);
          const reverseTransaction = createReverseTransactionUseCase(deps);

          const input: ReverseTransactionDTO = {
            originalTransactionId: "tx-reversal-seed",
            reference: reverseRef,
            reason: "checking error type",
            source: TransactionSource.SYSTEM,
          };

          let caught: unknown;
          try {
            await reverseTransaction(input);
          } catch (err) {
            caught = err;
          }

          expect(caught).toBeInstanceOf(DomainError);
          // Ensure it carries a typed code (plain Error would not have this)
          expect((caught as DomainError).code).toBeDefined();
          expect(typeof (caught as DomainError).code).toBe("string");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does NOT throw when reversing a non-REVERSAL transaction", async () => {

    const nonReversalTypes = [
      TxnType.CONTRIBUTION,
      TxnType.INTEREST_ACCRUAL,
      TxnType.REFERRAL_BONUS,
      TxnType.INVESTMENT_YIELD,
      TxnType.WITHDRAWAL,
    ] as const;

    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryReference,
        arbitraryReverseReference,
        fc.constantFrom(...nonReversalTypes),
        async (userId, originalRef, reverseRef, txnType) => {
          fc.pre(originalRef !== reverseRef);

          // For WITHDRAWAL, amount is negative; for others, positive
          const amountKobo = txnType === TxnType.WITHDRAWAL ? -1000n : 1000n;
          const user = {
            ...makeUser(userId),
            total_balance_kobo: txnType === TxnType.WITHDRAWAL ? 0n : 1000n,
            savings_balance_kobo: txnType === TxnType.WITHDRAWAL ? 0n : 1000n,
          };

          const originalTx: Transaction = {
            _id: "tx-original-seed",
            user_id: userId,
            type: txnType,
            amount_kobo: amountKobo,
            reference: originalRef,
            metadata: {},
            created_at: Date.now(),
          };

          const deps = makeInMemoryDeps(user, [originalTx]);
          const reverseTransaction = createReverseTransactionUseCase(deps);

          const input: ReverseTransactionDTO = {
            originalTransactionId: "tx-original-seed",
            reference: reverseRef,
            reason: "valid reversal",
            source: TransactionSource.ADMIN,
          };

          // Should resolve without throwing
          await expect(reverseTransaction(input)).resolves.toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("copies the original reference and type into the reversal audit fields", async () => {
    const userId = "user-reversal-fields";
    const originalTx: Transaction = {
      _id: "tx-original-fields",
      user_id: userId,
      type: TxnType.CONTRIBUTION,
      amount_kobo: 1_000n,
      reference: "original-contribution-ref",
      metadata: {},
      created_at: Date.now(),
    };
    const user = {
      ...makeUser(userId),
      total_balance_kobo: 1_000n,
      savings_balance_kobo: 1_000n,
    };
    const deps = makeInMemoryDeps(user, [originalTx]);
    const reverseTransaction = createReverseTransactionUseCase(deps);

    const result = await reverseTransaction({
      originalTransactionId: originalTx._id,
      reference: "reverse-contribution-ref",
      reason: "audit trail",
      source: TransactionSource.ADMIN,
    });

    expect(result.transaction.reversal_of_transaction_id).toBe(originalTx._id);
    expect(result.transaction.reversal_of_reference).toBe(originalTx.reference);
    expect(result.transaction.reversal_of_type).toBe(originalTx.type);

    const transactions = deps.getTransactions();
    expect(transactions).toHaveLength(2);
    expect(transactions[1]?.reversal_of_reference).toBe(originalTx.reference);
    expect(transactions[1]?.reversal_of_type).toBe(originalTx.type);
  });

  it("throws a DomainError when the original transaction does not exist", async () => {

    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryReverseReference,
        async (userId, reverseRef) => {
          const user = makeUser(userId);
          const deps = makeInMemoryDeps(user, []);
          const reverseTransaction = createReverseTransactionUseCase(deps);

          const input: ReverseTransactionDTO = {
            originalTransactionId: "tx-does-not-exist",
            reference: reverseRef,
            reason: "missing original",
            source: TransactionSource.ADMIN,
          };

          await expect(reverseTransaction(input)).rejects.toThrow(DomainError);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 16: Use-case errors are DomainError instances ---

describe("Property 16: Use-case errors are DomainError instances", () => {
  it("reversing a REVERSAL transaction throws an instance of DomainError (not a plain Error)", async () => {

    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryReference,
        arbitraryReverseReference,
        fc.record({
          amountKobo: fc.bigInt({ min: -10_000_000n, max: -1n }),
          metadata: fc.option(
            fc.dictionary(
              fc.string({ minLength: 1, maxLength: 16 }),
              fc.string(),
            ),
            { nil: undefined },
          ),
        }),
        async (userId, originalRef, reverseRef, extra) => {
          fc.pre(originalRef !== reverseRef);

          const user = makeUser(userId);

          // Seed a REVERSAL transaction — this is the "reversing a reversal" scenario
          const reversalTx: Transaction = {
            _id: "tx-reversal-p16",
            user_id: userId,
            type: TxnType.REVERSAL,
            amount_kobo: extra.amountKobo,
            reference: originalRef,
            metadata: extra.metadata ?? {},
            created_at: Date.now(),
          };

          const deps = makeInMemoryDeps(user, [reversalTx]);
          const reverseTransaction = createReverseTransactionUseCase(deps);

          const input: ReverseTransactionDTO = {
            originalTransactionId: "tx-reversal-p16",
            reference: reverseRef,
            reason: "property 16 test",
            source: TransactionSource.ADMIN,
          };

          let caught: unknown;
          try {
            await reverseTransaction(input);
          } catch (err) {
            caught = err;
          }

          // The error MUST be a DomainError subclass, not a plain Error
          expect(caught).toBeInstanceOf(DomainError);
          expect((caught as DomainError).code).toBeDefined();
          expect(typeof (caught as DomainError).code).toBe("string");
        },
      ),
      { numRuns: 100 },
    );
  });
});
