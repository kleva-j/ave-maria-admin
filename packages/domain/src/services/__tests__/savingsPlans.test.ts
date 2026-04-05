import { describe, expect, it } from "vitest";

import { PlanStatus } from "../../enums";
import {
  assertSavingsPlanCanAcceptContribution,
  extractSavingsPlanTemplateSnapshot,
  createSavingsPlanTemplateSnapshot,
  determineSavingsPlanClosedStatus,
  assertSavingsPlanIsMutable,
  buildSavingsPlanSummary,
  validateDurationDays,
  validateInterestRate,
  validateTargetKobo,
  resolvePlanDates,
} from "../savingsPlans";

describe("savings plan domain rules", () => {
  it("resolves default plan dates from start date and duration", () => {
    expect(
      resolvePlanDates({ durationDays: 30, startDate: "2026-04-04" }),
    ).toEqual({
      startDate: "2026-04-04",
      endDate: "2026-05-04",
    });
  });

  it("rejects end dates before the start date", () => {
    expect(() =>
      resolvePlanDates({
        durationDays: 30,
        startDate: "2026-04-04",
        endDate: "2026-04-01",
      }),
    ).toThrow("endDate cannot be before startDate");
  });

  it("builds overdue progress details from a persisted plan", () => {
    const summary = buildSavingsPlanSummary(
      {
        _id: "plan-1",
        user_id: "user-1",
        template_id: "template-1",
        custom_target_kobo: 100_000n,
        current_amount_kobo: 40_000n,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
        status: PlanStatus.ACTIVE,
        automation_enabled: false,
        metadata: {
          template_snapshot: createSavingsPlanTemplateSnapshot({
            name: "Japa",
            description: "Relocation goal",
            duration_days: 30,
            interest_rate: 0,
            automation_type: "weekly",
            default_target_kobo: 100_000n,
          }),
        },
        created_at: 1,
        updated_at: 1,
      },
      "2026-02-05",
    );

    expect(summary.progress_percentage).toBe(40);
    expect(summary.remaining_amount_kobo).toBe(60_000n);
    expect(summary.is_overdue).toBe(true);
    expect(summary.days_overdue).toBe(5);
    expect(summary.days_to_end).toBeUndefined();
    expect(summary.template_snapshot?.name).toBe("Japa");
  });

  it("builds active progress details for plans that are not overdue", () => {
    const summary = buildSavingsPlanSummary(
      {
        _id: "plan-2",
        user_id: "user-1",
        template_id: "template-1",
        custom_target_kobo: 100_000n,
        current_amount_kobo: 40_000n,
        start_date: "2026-04-01",
        end_date: "2026-04-20",
        status: PlanStatus.ACTIVE,
        automation_enabled: false,
        metadata: {},
        created_at: 1,
        updated_at: 1,
      },
      "2026-04-10",
    );

    expect(summary.is_overdue).toBe(false);
    expect(summary.days_overdue).toBeUndefined();
    expect(summary.days_to_end).toBe(10);
  });

  it("derives completed versus expired close states from target progress", () => {
    expect(
      determineSavingsPlanClosedStatus({
        current_amount_kobo: 100_000n,
        custom_target_kobo: 100_000n,
      }),
    ).toBe(PlanStatus.COMPLETED);

    expect(
      determineSavingsPlanClosedStatus({
        current_amount_kobo: 80_000n,
        custom_target_kobo: 100_000n,
      }),
    ).toBe(PlanStatus.EXPIRED);
  });

  it("rejects contributions for non-active plans", () => {
    expect(() =>
      assertSavingsPlanCanAcceptContribution({ status: PlanStatus.PAUSED }),
    ).toThrow("Only active savings plans can receive contributions");
  });

  it("accepts mutable plan statuses and rejects closed ones", () => {
    expect(() =>
      assertSavingsPlanIsMutable({ status: PlanStatus.ACTIVE }),
    ).not.toThrow();
    expect(() =>
      assertSavingsPlanIsMutable({ status: PlanStatus.PAUSED }),
    ).not.toThrow();
    expect(() =>
      assertSavingsPlanIsMutable({ status: PlanStatus.COMPLETED }),
    ).toThrow("Closed savings plans cannot be modified");
    expect(() =>
      assertSavingsPlanIsMutable({ status: PlanStatus.EXPIRED }),
    ).toThrow("Closed savings plans cannot be modified");
  });

  it("validates positive target amounts", () => {
    expect(validateTargetKobo(10_000n, "Savings plan target")).toBe(10_000n);
    expect(() => validateTargetKobo(0n)).toThrow(
      "Target must be greater than zero",
    );
  });

  it("validates savings plan durations", () => {
    expect(validateDurationDays(30)).toBe(30);
    expect(() => validateDurationDays(0)).toThrow(
      "durationDays must be a positive integer",
    );
    expect(() => validateDurationDays(14.5)).toThrow(
      "durationDays must be a positive integer",
    );
  });

  it("validates non-negative interest rates", () => {
    expect(validateInterestRate(0)).toBe(0);
    expect(validateInterestRate(12.5)).toBe(12.5);
    expect(() => validateInterestRate(-1)).toThrow(
      "interestRate must be a non-negative number",
    );
    expect(() => validateInterestRate(Number.NaN)).toThrow(
      "interestRate must be a non-negative number",
    );
  });

  it("tolerates legacy plan metadata with no template snapshot", () => {
    expect(extractSavingsPlanTemplateSnapshot(undefined)).toBeUndefined();
    expect(extractSavingsPlanTemplateSnapshot({})).toBeUndefined();
  });
});
