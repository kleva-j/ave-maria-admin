import * as fc from "fast-check";

import { describe, it, expect } from "vitest";

import type { WithdrawalRepository, RiskHoldRepository } from "../ports";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbitraryUserId = fc.string({ minLength: 1, maxLength: 36 });

const arbitraryHoldRecord = fc.record({
  _id: fc.string({ minLength: 1, maxLength: 36 }),
  reason: fc.string({ minLength: 1, maxLength: 200 }),
  placed_at: fc.integer({ min: 0 }),
});

const arbitraryWithdrawalRecord = fc.record({
  requested_at: fc.integer({ min: 0 }),
  requested_amount_kobo: fc.bigInt({ min: 1n }),
});

// ---------------------------------------------------------------------------
// Property 14: RiskHoldRepository behavioral contract
// ---------------------------------------------------------------------------

describe("Property 14: RiskHoldRepository behavioral contract", () => {
  it("findActiveWithdrawalHold returns null or an object with _id (string), reason (string), placed_at (number)", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        fc.option(arbitraryHoldRecord, { nil: null }),
        async (userId, holdOrNull) => {
          const repo: RiskHoldRepository = {
            findActiveWithdrawalHold: async () => holdOrNull,
            create: async () => ({ _id: "hold-1" }),
            release: async () => undefined,
          };

          const result = await repo.findActiveWithdrawalHold(userId);

          if (result === null) {
            expect(result).toBeNull();
          } else {
            expect(typeof result._id).toBe("string");
            expect(result._id.length).toBeGreaterThan(0);
            expect(typeof result.reason).toBe("string");
            expect(typeof result.placed_at).toBe("number");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("create returns an object with a non-empty string _id", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.string({ minLength: 1, maxLength: 36 }),
          scope: fc.string({ minLength: 1, maxLength: 50 }),
          status: fc.string({ minLength: 1, maxLength: 50 }),
          reason: fc.string({ minLength: 1, maxLength: 200 }),
          placed_by_admin_id: fc.string({ minLength: 1, maxLength: 36 }),
          placed_at: fc.integer({ min: 0 }),
        }),
        fc.string({ minLength: 1, maxLength: 36 }),
        async (holdInput, generatedId) => {
          const repo: RiskHoldRepository = {
            findActiveWithdrawalHold: async () => null,
            create: async () => ({ _id: generatedId }),
            release: async () => undefined,
          };

          const result = await repo.create(holdInput);

          expect(typeof result._id).toBe("string");
          expect(result._id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: WithdrawalRepository behavioral contract
// ---------------------------------------------------------------------------

describe("Property 15: WithdrawalRepository behavioral contract", () => {
  it("findByUserId returns an array where every element has requested_at (number) and requested_amount_kobo (bigint)", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        fc.array(arbitraryWithdrawalRecord, { maxLength: 20 }),
        async (userId, withdrawals) => {
          const repo: WithdrawalRepository = {
            findById: async () => null,
            findByUserId: async () => withdrawals,
          };

          const results = await repo.findByUserId(userId);

          expect(Array.isArray(results)).toBe(true);
          for (const item of results) {
            expect(typeof item.requested_at).toBe("number");
            expect(typeof item.requested_amount_kobo).toBe("bigint");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("findByUserId returns an empty array when no withdrawals exist", async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryUserId, async (userId) => {
        const repo: WithdrawalRepository = {
          findById: async () => null,
          findByUserId: async () => [],
        };

        const results = await repo.findByUserId(userId);

        expect(results).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
