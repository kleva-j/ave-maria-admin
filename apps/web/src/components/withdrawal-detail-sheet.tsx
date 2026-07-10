import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { formatNaira } from "@avm-daily/application/client";
import { Icon } from "@avm-daily/ui/components/icon";
import { cn } from "@avm-daily/ui/lib/utils";
import {
  SheetContent,
  SheetHeader,
  SheetClose,
  SheetTitle,
  Sheet,
} from "@avm-daily/ui/components/sheet";

import { WithdrawalStatusBadge } from "@/components/withdrawal-status-badge";

/**
 * Slide-in detail for a single withdrawal. Includes a four-step status
 * tracker (Requested → Approved → Processing → Processed) plus rejection
 * detail when rejected. Matches roadmap §7.4 acceptance.
 */

export type WithdrawalDetailData = {
  _id: Id<"withdrawals">;
  reference: string;
  requested_amount_kobo: bigint;
  status: string;
  requested_at: number;
  approved_at?: number | undefined;
  processed_at?: number | undefined;
  rejection_reason?: string | undefined;
  payout_provider?: string | undefined;
  payout_reference?: string | undefined;
  last_processing_error?: string | undefined;
  bank_account?:
    | {
        bank_name: string;
        account_number_last4?: string | undefined;
        account_name?: string | undefined;
      }
    | undefined;
};

const STEPS = ["requested", "approved", "processing", "processed"] as const;

function stageIndex(status: string): number {
  // STEPS = requested(0) → approved(1) → processing(2) → processed(3).
  // "rejected" branches to a dedicated panel in the renderer and never hits
  // this — the default 0 is a safe fallback for unknown states.
  switch (status) {
    case "approved":
      return 1;
    case "processing":
      return 2;
    case "processed":
      return 3;
    default:
      return 0;
  }
}

type WithdrawalDetailSheetProps = {
  withdrawal: WithdrawalDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WithdrawalDetailSheet({
  onOpenChange,
  withdrawal,
  open,
}: WithdrawalDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-theme="midnight" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Withdrawal detail</SheetTitle>
          <SheetClose aria-label="Close">
            <Icon name="x" size={16} />
          </SheetClose>
        </SheetHeader>
        {withdrawal == null ? (
          <div className="p-6 text-sm text-muted-foreground">
            No withdrawal selected.
          </div>
        ) : (
          <Body withdrawal={withdrawal} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({ withdrawal }: { withdrawal: WithdrawalDetailData }) {
  const rejected = withdrawal.status === "rejected";
  const idx = stageIndex(withdrawal.status);

  const rows: Array<[string, string]> = [];
  if (withdrawal.bank_account != null) {
    rows.push([
      "To",
      `${withdrawal.bank_account.bank_name}${
        withdrawal.bank_account.account_number_last4
          ? ` · •••• ${withdrawal.bank_account.account_number_last4}`
          : ""
      }`,
    ]);
  }
  rows.push(["Reference", withdrawal.reference]);
  rows.push([
    "Requested",
    new Date(withdrawal.requested_at).toLocaleString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  ]);
  if (withdrawal.approved_at != null) {
    rows.push([
      "Approved",
      new Date(withdrawal.approved_at).toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    ]);
  }
  if (withdrawal.processed_at != null) {
    rows.push([
      "Processed",
      new Date(withdrawal.processed_at).toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    ]);
  }
  if (
    withdrawal.payout_provider != null &&
    withdrawal.payout_reference != null
  ) {
    rows.push([
      "Payout reference",
      `${withdrawal.payout_provider} · ${withdrawal.payout_reference}`,
    ]);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="mb-5 rounded-[18px] border border-border bg-secondary/40 p-5 text-center">
        <p className="text-xs text-muted-foreground">Amount</p>
        <p className="mt-1 font-display-tight text-3xl font-bold text-foreground">
          {formatNaira(withdrawal.requested_amount_kobo)}
        </p>
        <div className="mt-2 flex justify-center">
          <WithdrawalStatusBadge status={withdrawal.status} />
        </div>
      </div>

      <StatusTracker
        rejected={rejected}
        rejectionReason={withdrawal.rejection_reason}
        currentIndex={idx}
      />

      <dl className="mt-5 flex flex-col gap-3.5">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-b border-border pb-3.5"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="max-w-[60%] break-words text-right text-sm font-medium text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {withdrawal.last_processing_error != null && (
        <div className="mt-4 rounded-[12px] border border-destructive/40 bg-destructive-dim p-3.5">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-destructive">
            Processing error
          </div>
          <div className="text-xs text-destructive">
            {withdrawal.last_processing_error}
          </div>
        </div>
      )}
    </div>
  );
}

type StatusTrackerProps = {
  rejected: boolean;
  rejectionReason: string | undefined;
  currentIndex: number;
};

function StatusTracker({
  rejectionReason,
  currentIndex,
  rejected,
}: StatusTrackerProps) {
  if (rejected) {
    return (
      <div className="rounded-[14px] border border-destructive/40 bg-destructive-dim p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive-dim">
            <Icon name="x" size={16} color="var(--destructive)" />
          </span>
          <div>
            <div className="text-sm font-bold text-destructive">Rejected</div>
            {rejectionReason != null && (
              <div className="text-xs text-muted-foreground">
                {rejectionReason}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <ol className="rounded-[14px] border border-border bg-card p-4">
      {STEPS.map((step, i) => {
        const active = i <= currentIndex;
        const done = i < currentIndex;
        return (
          <li
            key={step}
            className={cn(
              "relative flex items-center gap-3 py-1.5",
              i < STEPS.length - 1 && "pb-4",
            )}
          >
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                active
                  ? "border-primary bg-primary-dim"
                  : "border-border bg-secondary",
              )}
            >
              <Icon
                name={done ? "check" : "clock"}
                size={14}
                color={
                  done
                    ? "var(--primary)"
                    : active
                      ? "var(--primary)"
                      : "var(--muted-foreground)"
                }
                strokeWidth={2.5}
              />
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "absolute left-3.75 top-9 h-4 w-px",
                  active ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "text-sm font-medium capitalize",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
