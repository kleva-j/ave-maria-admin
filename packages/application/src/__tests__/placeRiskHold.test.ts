import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { createPlaceRiskHoldUseCase } from "../use-cases/index.js";

import type {
  RiskHoldRepository,
  RiskEventService,
  AuditLogService,
} from "../ports/index.js";

// --- Arbitrary generators ---

const arbitraryUserId = fc.string({ minLength: 1, maxLength: 36 });
const arbitraryAdminId = fc.string({ minLength: 1, maxLength: 36 });
const arbitraryReason = fc.string({ minLength: 1, maxLength: 200 });

// --- Spy implementations ---

function makeRiskHoldRepository(): RiskHoldRepository {
  return {
    findActiveWithdrawalHold: async () => null, // no existing hold → place succeeds
    create: async () => ({ _id: "hold-1" }),
    release: async () => undefined,
  };
}

function makeRiskEventServiceSpy(): RiskEventService & { callCount: number } {
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

function makeAuditLogServiceSpy(): AuditLogService & {
  logCallCount: number;
  logChangeCallCount: number;
} {
  let logCallCount = 0;
  let logChangeCallCount = 0;
  return {
    get logCallCount() {
      return logCallCount;
    },
    get logChangeCallCount() {
      return logChangeCallCount;
    },
    log: async () => {
      logCallCount++;
    },
    logChange: async () => {
      logChangeCallCount++;
    },
  };
}

// --- Property 6: placeRiskHold calls riskEventService.record and auditLogService.log exactly once ---

describe("Property 6: placeRiskHold calls audit log and risk event service exactly once", () => {
  it("riskEventService.record and auditLogService.log are each called exactly once on success", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAdminId,
        arbitraryReason,
        async (userId, adminId, reason) => {
          const riskEventService = makeRiskEventServiceSpy();
          const auditLogService = makeAuditLogServiceSpy();

          const placeRiskHold = createPlaceRiskHoldUseCase({
            riskHoldRepository: makeRiskHoldRepository(),
            riskEventService,
            auditLogService,
          });

          await placeRiskHold({ userId, adminId, reason });

          expect(riskEventService.callCount).toBe(1);
          expect(auditLogService.logCallCount).toBe(1);
          expect(auditLogService.logChangeCallCount).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
