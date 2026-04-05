import type { SavingsPlanTemplate, UserSavingsPlan } from "../entities";
import type { PlanStatus } from "../enums";

import {
  differenceInCalendarDays,
  parseISO,
  addDays,
  isValid,
  format,
} from "date-fns";

import { PlanStatus as PS } from "../enums";
import { DomainError } from "../errors";

export type SavingsPlanTemplateSnapshot = {
  name: string;
  description?: string;
  duration_days: number;
  interest_rate: number;
  automation_type?: string;
  default_target_kobo: bigint;
};

export type SavingsPlanSummary = UserSavingsPlan & {
  template_snapshot?: SavingsPlanTemplateSnapshot;
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
    throw new DomainError(
      "Template name is required",
      "template_name_required",
    );
  }

  return trimmed;
}

export function validateTargetKobo(value: bigint, fieldName = "Target") {
  if (value <= 0n) {
    throw new DomainError(
      `${fieldName} must be greater than zero`,
      "invalid_target_kobo",
    );
  }

  return value;
}

export function validateDurationDays(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainError(
      "durationDays must be a positive integer",
      "invalid_duration_days",
    );
  }

  return value;
}

export function validateInterestRate(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError(
      "interestRate must be a non-negative number",
      "invalid_interest_rate",
    );
  }

  return value;
}

export function todayIsoDate(now = new Date()) {
  return format(now, "yyyy-MM-dd");
}

export function parseIsoDate(value: string, fieldName = "date") {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new DomainError(
      `${fieldName} must be in YYYY-MM-DD format`,
      "invalid_iso_date",
    );
  }

  const date = parseISO(value);

  if (!isValid(date)) {
    throw new DomainError(
      `${fieldName} must be a valid calendar date`,
      "invalid_calendar_date",
    );
  }

  return date;
}

export function addDaysToIsoDate(value: string, days: number) {
  const date = parseIsoDate(value, "startDate");
  const result = addDays(date, days);
  return todayIsoDate(result);
}

export function diffCalendarDays(fromIso: string, toIso: string) {
  const from = parseIsoDate(fromIso, "fromDate");
  const to = parseIsoDate(toIso, "toDate");

  return differenceInCalendarDays(to, from);
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
    throw new DomainError(
      "endDate cannot be before startDate",
      "invalid_plan_date_range",
    );
  }

  return { startDate, endDate };
}

export function createSavingsPlanTemplateSnapshot(
  template: Pick<
    SavingsPlanTemplate,
    | "name"
    | "description"
    | "duration_days"
    | "interest_rate"
    | "automation_type"
    | "default_target_kobo"
  >,
): SavingsPlanTemplateSnapshot {
  return {
    name: template.name,
    description: template.description,
    duration_days: template.duration_days,
    interest_rate: template.interest_rate,
    automation_type: template.automation_type,
    default_target_kobo: template.default_target_kobo,
  };
}

export function extractSavingsPlanTemplateSnapshot(
  metadata: unknown,
): SavingsPlanTemplateSnapshot | undefined {
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

export function assertSavingsPlanIsMutable(
  plan: Pick<UserSavingsPlan, "status">,
) {
  if (plan.status !== PS.ACTIVE && plan.status !== PS.PAUSED) {
    throw new DomainError(
      "Closed savings plans cannot be modified",
      "savings_plan_not_mutable",
    );
  }
}

export function assertSavingsPlanCanAcceptContribution(
  plan: Pick<UserSavingsPlan, "status">,
) {
  if (plan.status !== PS.ACTIVE) {
    throw new DomainError(
      "Only active savings plans can receive contributions",
      "savings_plan_not_active",
    );
  }
}

export function determineSavingsPlanClosedStatus(
  plan: Pick<UserSavingsPlan, "current_amount_kobo" | "custom_target_kobo">,
): PlanStatus {
  return plan.current_amount_kobo >= plan.custom_target_kobo
    ? PS.COMPLETED
    : PS.EXPIRED;
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
  const activeForDates = plan.status === PS.ACTIVE || plan.status === PS.PAUSED;
  const daysUntilEnd = diffCalendarDays(today, plan.end_date);
  const isOverdue = activeForDates && daysUntilEnd < 0;

  return {
    ...plan,
    template_snapshot: extractSavingsPlanTemplateSnapshot(plan.metadata),
    progress_percentage: progressBasisPoints / 100,
    remaining_amount_kobo: remainingAmountKobo,
    is_overdue: isOverdue,
    days_to_end: activeForDates && !isOverdue ? daysUntilEnd : undefined,
    days_overdue:
      activeForDates && isOverdue ? Math.abs(daysUntilEnd) : undefined,
  };
}
