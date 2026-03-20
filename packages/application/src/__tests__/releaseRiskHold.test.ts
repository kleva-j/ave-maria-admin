import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { createReleaseRiskHoldUseCase } from "../use-cases/index.js";

import type {
  RiskHoldRepository,
  RiskEventService,
  AuditLogService,
} from "../ports/index.js";

// Feature: clean-architecture-refactor, Property 6: Audit log and risk event service are called on hold operations

// --- Arbitrary generators ---

const arbitraryUserId = fc.string({ minLength: 1, maxLength: 36 });
const arbitraryAdminId = fc.string({ minLength: 1, maxLength: 36 });
const arbitraryReason = fc.string({ minLength: 1, maxLength: 200 });
const arbitraryPlacedAt = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });
const arbitraryHoldId = fc.string({ minLength: 1, maxLength: 36 });

// --- Spy implementations ---

function makeRiskHoldRepositoryWithActiveHold(
  holdId: string,
  reason: string,
  placedAt: number,
): RiskHoldRepository {
  return {
    // Returns a valid active hold so releaseRiskHold succeeds
    findActiveWithdrawalHold: async () => ({
      _id: holdId,
      reason,
      placed_at: placedAt,
    }),
    create: async () => ({ _id: holdId }),
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

// --- Property 6: releaseRiskHold calls riskEventService.record and auditLogService.logChange exactly once ---

describe("Property 6: releaseRiskHold calls audit log and risk event service exactly once", () => {
  it("riskEventService.record and auditLogService.logChange are each called exactly once on success", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAdminId,
        arbitraryHoldId,
        arbitraryReason,
        arbitraryPlacedAt,
        async (userId, adminId, holdId, reason, placedAt) => {
          const riskEventService = makeRiskEventServiceSpy();
          const auditLogService = makeAuditLogServiceSpy();

          const releaseRiskHold = createReleaseRiskHoldUseCase({
            riskHoldRepository: makeRiskHoldRepositoryWithActiveHold(
              holdId,
              reason,
              placedAt,
            ),
            riskEventService,
            auditLogService,
          });

          await releaseRiskHold({ userId, adminId });

          expect(riskEventService.callCount).toBe(1);
          expect(auditLogService.logChangeCallCount).toBe(1);
          expect(auditLogService.logCallCount).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
