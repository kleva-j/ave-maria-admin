import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import {
  createEvaluateWithdrawalRiskUseCase,
  createAssertWithdrawalAllowedUseCase,
  createPlaceRiskHoldUseCase,
  createReleaseRiskHoldUseCase,
  createBuildWithdrawalCapabilitiesUseCase,
} from "../use-cases/index.js";

import type {
  RiskHoldRepository,
  WithdrawalRepository,
  BankAccountEventRepository,
  RiskEventService,
  AuditLogService,
} from "../ports/index.js";

// --- In-memory mock implementations of Port interfaces ---

function makeRiskHoldRepository(): RiskHoldRepository {
  return {
    findActiveWithdrawalHold: async () => null,
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

function makeRiskEventService(): RiskEventService {
  return {
    record: async () => ({ id: "event-1" }),
  };
}

function makeAuditLogService(): AuditLogService {
  return {
    log: async () => undefined,
    logChange: async () => undefined,
  };
}

// --- Property 5: Use-case factories return async functions ---

describe("Property 5: Use-case factories return async functions", () => {
  // Feature: clean-architecture-refactor, Property 5: Use-case factories return async functions

  it("createEvaluateWithdrawalRiskUseCase returns a function", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const useCase = createEvaluateWithdrawalRiskUseCase({
          riskHoldRepository: makeRiskHoldRepository(),
          withdrawalRepository: makeWithdrawalRepository(),
          bankAccountEventRepository: makeBankAccountEventRepository(),
        });
        return typeof useCase === "function";
      }),
      { numRuns: 100 },
    );
  });

  it("createAssertWithdrawalAllowedUseCase returns a function", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const evaluateWithdrawalRisk = createEvaluateWithdrawalRiskUseCase({
          riskHoldRepository: makeRiskHoldRepository(),
          withdrawalRepository: makeWithdrawalRepository(),
          bankAccountEventRepository: makeBankAccountEventRepository(),
        });
        const useCase = createAssertWithdrawalAllowedUseCase({
          evaluateWithdrawalRisk,
          riskEventService: makeRiskEventService(),
        });
        return typeof useCase === "function";
      }),
      { numRuns: 100 },
    );
  });

  it("createPlaceRiskHoldUseCase returns a function", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const useCase = createPlaceRiskHoldUseCase({
          riskHoldRepository: makeRiskHoldRepository(),
          riskEventService: makeRiskEventService(),
          auditLogService: makeAuditLogService(),
        });
        return typeof useCase === "function";
      }),
      { numRuns: 100 },
    );
  });

  it("createReleaseRiskHoldUseCase returns a function", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const useCase = createReleaseRiskHoldUseCase({
          riskHoldRepository: makeRiskHoldRepository(),
          riskEventService: makeRiskEventService(),
          auditLogService: makeAuditLogService(),
        });
        return typeof useCase === "function";
      }),
      { numRuns: 100 },
    );
  });

  it("createBuildWithdrawalCapabilitiesUseCase returns a function", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const useCase = createBuildWithdrawalCapabilitiesUseCase({
          riskHoldRepository: makeRiskHoldRepository(),
        });
        return typeof useCase === "function";
      }),
      { numRuns: 100 },
    );
  });
});
