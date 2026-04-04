import type { SavingsPlanTemplate, UserSavingsPlan } from "./types";

import { ConvexError } from "convex/values";

import { PlanStatus } from "./shared";

export type TemplateSnapshot = {
  name: string;
  description?: string;
  duration_days: number;
  interest_rate: number;
  automation_type?: string;
  default_target_kobo: bigint;
};

export type SavingsPlanSummary = UserSavingsPlan & {
  template_snapshot?: TemplateSnapshot;
  progress_percentage: number;
  remaining_amount_kobo: bigint;
  is_overdue: boolean;
  days_to_end?: number;
  days_overdue?: number;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function validateTemplateName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ConvexError("Template name is required");
  }

  return trimmed;
}

export function validateTargetKobo(value: bigint, fieldName = "Target") {
  if (value <= 0n) {
    throw new ConvexError(`${fieldName} must be greater than zero`);
  }

  return value;
}

export function validateDurationDays(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConvexError("durationDays must be a positive integer");
  }

  return value;
}

export function validateInterestRate(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ConvexError("interestRate must be a non-negative number");
  }

  return value;
}

export function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string, fieldName = "date") {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new ConvexError(`${fieldName} must be in YYYY-MM-DD format`);
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ConvexError(`${fieldName} must be a valid calendar date`);
  }

  return date;
}

export function addDaysToIsoDate(value: string, days: number) {
  const date = parseIsoDate(value, "startDate");
  date.setUTCDate(date.getUTCDate() + days);
  return todayIsoDate(date);
}

export function diffCalendarDays(fromIso: string, toIso: string) {
  const from = parseIsoDate(fromIso, "fromDate");
  const to = parseIsoDate(toIso, "toDate");
  const differenceMs = to.getTime() - from.getTime();

  return Math.round(differenceMs / 86_400_000);
}

export function resolvePlanDates(params: {
  durationDays: number;
  startDate?: string;
  endDate?: string;
  today?: string;
}) {
  const durationDays = validateDurationDays(params.durationDays);
  const resolvedToday = params.today ?? todayIsoDate();
  parseIsoDate(resolvedToday, "today");

  const startDate = params.startDate
    ? todayIsoDate(parseIsoDate(params.startDate, "startDate"))
    : resolvedToday;

  const endDate = params.endDate
    ? todayIsoDate(parseIsoDate(params.endDate, "endDate"))
    : addDaysToIsoDate(startDate, durationDays);

  if (diffCalendarDays(startDate, endDate) < 0) {
    throw new ConvexError("endDate cannot be before startDate");
  }

  return { startDate, endDate };
}

export function createTemplateSnapshot(
  template: Pick<
    SavingsPlanTemplate,
    | "name"
    | "description"
    | "duration_days"
    | "interest_rate"
    | "automation_type"
    | "default_target_kobo"
  >,
): TemplateSnapshot {
  return {
    name: template.name,
    description: template.description,
    duration_days: template.duration_days,
    interest_rate: template.interest_rate,
    automation_type: template.automation_type,
    default_target_kobo: template.default_target_kobo,
  };
}

export function extractTemplateSnapshot(
  metadata: unknown,
): TemplateSnapshot | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.template_snapshot)) {
    return undefined;
  }

  const snapshot = metadata.template_snapshot;
  const defaultTarget = snapshot.default_target_kobo;

  if (
    typeof snapshot.name !== "string" ||
    typeof snapshot.duration_days !== "number" ||
    typeof snapshot.interest_rate !== "number"
  ) {
    return undefined;
  }

  if (typeof defaultTarget !== "bigint" && typeof defaultTarget !== "number") {
    return undefined;
  }

  return {
    name: snapshot.name,
    description:
      typeof snapshot.description === "string"
        ? snapshot.description
        : undefined,
    duration_days: snapshot.duration_days,
    interest_rate: snapshot.interest_rate,
    automation_type:
      typeof snapshot.automation_type === "string"
        ? snapshot.automation_type
        : undefined,
    default_target_kobo:
      typeof defaultTarget === "bigint"
        ? defaultTarget
        : BigInt(Math.trunc(defaultTarget)),
  };
}

export function assertPlanIsMutable(plan: Pick<UserSavingsPlan, "status">) {
  if (plan.status !== PlanStatus.ACTIVE && plan.status !== PlanStatus.PAUSED) {
    throw new ConvexError("Closed savings plans cannot be modified");
  }
}

export function assertPlanCanAcceptContribution(
  plan: Pick<UserSavingsPlan, "status">,
) {
  if (plan.status !== PlanStatus.ACTIVE) {
    throw new ConvexError(
      "Only active savings plans can receive contributions",
    );
  }
}

export function determineClosedStatus(
  plan: Pick<UserSavingsPlan, "current_amount_kobo" | "custom_target_kobo">,
) {
  return plan.current_amount_kobo >= plan.custom_target_kobo
    ? PlanStatus.COMPLETED
    : PlanStatus.EXPIRED;
}

export function buildSavingsPlanSummary(
  plan: UserSavingsPlan,
  today = todayIsoDate(),
): SavingsPlanSummary {
  const target = plan.custom_target_kobo;
  const progressBasisPoints =
    target <= 0n ? 0 : Number((plan.current_amount_kobo * 10_000n) / target);
  const remainingAmountKobo =
    plan.current_amount_kobo >= target ? 0n : target - plan.current_amount_kobo;
  const activeForDates =
    plan.status === PlanStatus.ACTIVE || plan.status === PlanStatus.PAUSED;
  const daysUntilEnd = diffCalendarDays(today, plan.end_date);
  const isOverdue = activeForDates && daysUntilEnd < 0;

  return {
    ...plan,
    template_snapshot: extractTemplateSnapshot(plan.metadata),
    progress_percentage: progressBasisPoints / 100,
    remaining_amount_kobo: remainingAmountKobo,
    is_overdue: isOverdue,
    days_to_end: activeForDates && !isOverdue ? daysUntilEnd : undefined,
    days_overdue:
      activeForDates && isOverdue ? Math.abs(daysUntilEnd) : undefined,
  };
}
