import { describe, expect, it } from "vitest";

import { PlanStatus } from "./shared";
import {
  assertPlanCanAcceptContribution,
  buildSavingsPlanSummary,
  createTemplateSnapshot,
  determineClosedStatus,
  extractTemplateSnapshot,
  resolvePlanDates,
} from "./savingsPlanRules";

describe("savingsPlanRules", () => {
  it("resolves default plan dates from start date and duration", () => {
    expect(
      resolvePlanDates({ durationDays: 30, startDate: "2026-04-04" }),
    ).toEqual({ startDate: "2026-04-04", endDate: "2026-05-04" });
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
        _id: "plan-1" as never,
        _creationTime: 1,
        user_id: "user-1" as never,
        template_id: "template-1" as never,
        custom_target_kobo: 100_000n,
        current_amount_kobo: 40_000n,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
        status: PlanStatus.ACTIVE,
        automation_enabled: false,
        metadata: {
          template_snapshot: createTemplateSnapshot({
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

  it("derives completed versus expired close states from target progress", () => {
    expect(
      determineClosedStatus({
        current_amount_kobo: 100_000n,
        custom_target_kobo: 100_000n,
      }),
    ).toBe(PlanStatus.COMPLETED);

    expect(
      determineClosedStatus({
        current_amount_kobo: 80_000n,
        custom_target_kobo: 100_000n,
      }),
    ).toBe(PlanStatus.EXPIRED);
  });

  it("rejects contributions for non-active plans", () => {
    expect(() =>
      assertPlanCanAcceptContribution({ status: PlanStatus.PAUSED } as never),
    ).toThrow("Only active savings plans can receive contributions");
  });

  it("tolerates legacy plan metadata with no template snapshot", () => {
    expect(extractTemplateSnapshot(undefined)).toBeUndefined();
    expect(extractTemplateSnapshot({})).toBeUndefined();
  });
});
