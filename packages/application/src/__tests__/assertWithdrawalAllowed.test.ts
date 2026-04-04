import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import {
  createAssertWithdrawalAllowedUseCase,
  createEvaluateWithdrawalRiskUseCase,
} from "../use-cases/index.js";

import type {
  RiskHoldRepository,
  WithdrawalRepository,
  BankAccountEventRepository,
  RiskEventService,
} from "../ports/index.js";

import type { WithdrawalMethod } from "@avm-daily/domain";

// --- Arbitrary generators ---

const arbitraryUserId = fc.string({ minLength: 1, maxLength: 36 });
const arbitraryAmountKobo = fc.bigInt({ min: 1n, max: 10_000_000n });
const arbitraryMethod = fc.constantFrom<WithdrawalMethod>(
  "bank_transfer",
  "cash",
);

// --- In-memory mock implementations ---

function makeRiskHoldRepository(
  activeHold: { _id: string; reason: string; placed_at: number } | null = null,
): RiskHoldRepository {
  return {
    findActiveWithdrawalHold: async () => activeHold,
    create: async () => ({ _id: "hold-1" }),
    release: async () => undefined,
  };
}

function makeWithdrawalRepository(): WithdrawalRepository {
  return {
    findById: async () => null,
    findByUserId: async () => [],
  };
}

function makeBankAccountEventRepository(): BankAccountEventRepository {
  return {
    getLastBankAccountChangeAt: async () => undefined,
  };
}

function makeRiskEventService(): RiskEventService & { callCount: number } {
  let callCount = 0;
  return {
    get callCount() {
      return callCount;
    },
    record: async () => {
      callCount++;
      return { id: "event-1" };
    },
  };
}

// --- Spy wrapper for evaluateWithdrawalRisk ---

type EvaluateWithdrawalRiskFn = ReturnType<
  typeof createEvaluateWithdrawalRiskUseCase
>;

function makeEvaluateWithdrawalRiskSpy(
  inner: EvaluateWithdrawalRiskFn,
): EvaluateWithdrawalRiskFn & {
  callCount: number;
  lastArgs: Parameters<EvaluateWithdrawalRiskFn>[0] | undefined;
} {
  let callCount = 0;
  let lastArgs: Parameters<EvaluateWithdrawalRiskFn>[0] | undefined;

  const spy = async (
    input: Parameters<EvaluateWithdrawalRiskFn>[0],
  ): ReturnType<EvaluateWithdrawalRiskFn> => {
    callCount++;
    lastArgs = input;
    return inner(input);
  };

  Object.defineProperty(spy, "callCount", { get: () => callCount });
  Object.defineProperty(spy, "lastArgs", { get: () => lastArgs });

  return spy as EvaluateWithdrawalRiskFn & {
    callCount: number;
    lastArgs: Parameters<EvaluateWithdrawalRiskFn>[0] | undefined;
  };
}

// --- Property 7: Assert withdrawal delegates to evaluate withdrawal ---

describe("Property 7: Assert withdrawal delegates to evaluate withdrawal", () => {
  it("evaluateWithdrawalRisk is called exactly once with the same userId, amountKobo, and method (allowed path)", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAmountKobo,
        arbitraryMethod,
        async (userId, amountKobo, method) => {
          const innerEvaluate = createEvaluateWithdrawalRiskUseCase({
            riskHoldRepository: makeRiskHoldRepository(null),
            withdrawalRepository: makeWithdrawalRepository(),
            bankAccountEventRepository: makeBankAccountEventRepository(),
          });

          const evaluateSpy = makeEvaluateWithdrawalRiskSpy(innerEvaluate);
          const riskEventService = makeRiskEventService();

          const assertWithdrawalAllowed = createAssertWithdrawalAllowedUseCase({
            evaluateWithdrawalRisk: evaluateSpy,
            riskEventService,
          });

          await assertWithdrawalAllowed({ userId, amountKobo, method });

          expect(evaluateSpy.callCount).toBe(1);
          expect(evaluateSpy.lastArgs?.userId).toBe(userId);
          expect(evaluateSpy.lastArgs?.amountKobo).toBe(amountKobo);
          expect(evaluateSpy.lastArgs?.method).toBe(method);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("evaluateWithdrawalRisk is called exactly once and use-case throws when evaluation returns blocked", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAmountKobo,
        arbitraryMethod,
        async (userId, amountKobo, method) => {
          // Inject an active hold so evaluation returns blocked
          const innerEvaluate = createEvaluateWithdrawalRiskUseCase({
            riskHoldRepository: makeRiskHoldRepository({
              _id: "hold-1",
              reason: "manual hold",
              placed_at: Date.now() - 1000,
            }),
            withdrawalRepository: makeWithdrawalRepository(),
            bankAccountEventRepository: makeBankAccountEventRepository(),
          });

          const evaluateSpy = makeEvaluateWithdrawalRiskSpy(innerEvaluate);
          const riskEventService = makeRiskEventService();

          const assertWithdrawalAllowed = createAssertWithdrawalAllowedUseCase({
            evaluateWithdrawalRisk: evaluateSpy,
            riskEventService,
          });

          await expect(
            assertWithdrawalAllowed({ userId, amountKobo, method }),
          ).rejects.toThrow();

          expect(evaluateSpy.callCount).toBe(1);
          expect(evaluateSpy.lastArgs?.userId).toBe(userId);
          expect(evaluateSpy.lastArgs?.amountKobo).toBe(amountKobo);
          expect(evaluateSpy.lastArgs?.method).toBe(method);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("riskEventService.record is called when evaluation returns blocked", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAmountKobo,
        arbitraryMethod,
        async (userId, amountKobo, method) => {
          const innerEvaluate = createEvaluateWithdrawalRiskUseCase({
            riskHoldRepository: makeRiskHoldRepository({
              _id: "hold-1",
              reason: "manual hold",
              placed_at: Date.now() - 1000,
            }),
            withdrawalRepository: makeWithdrawalRepository(),
            bankAccountEventRepository: makeBankAccountEventRepository(),
          });

          const evaluateSpy = makeEvaluateWithdrawalRiskSpy(innerEvaluate);
          const riskEventService = makeRiskEventService();

          const assertWithdrawalAllowed = createAssertWithdrawalAllowedUseCase({
            evaluateWithdrawalRisk: evaluateSpy,
            riskEventService,
          });

          await expect(
            assertWithdrawalAllowed({ userId, amountKobo, method }),
          ).rejects.toThrow();

          expect(riskEventService.callCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("riskEventService.record is NOT called when evaluation returns allowed", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAmountKobo,
        arbitraryMethod,
        async (userId, amountKobo, method) => {
          const innerEvaluate = createEvaluateWithdrawalRiskUseCase({
            riskHoldRepository: makeRiskHoldRepository(null),
            withdrawalRepository: makeWithdrawalRepository(),
            bankAccountEventRepository: makeBankAccountEventRepository(),
          });

          const evaluateSpy = makeEvaluateWithdrawalRiskSpy(innerEvaluate);
          const riskEventService = makeRiskEventService();

          const assertWithdrawalAllowed = createAssertWithdrawalAllowedUseCase({
            evaluateWithdrawalRisk: evaluateSpy,
            riskEventService,
          });

          await assertWithdrawalAllowed({ userId, amountKobo, method });

          expect(riskEventService.callCount).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
