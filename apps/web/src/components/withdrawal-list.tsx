import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useState } from "react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { formatNaira } from "@avm-daily/application/client";
import { Icon } from "@avm-daily/ui/components/icon";

import { WithdrawalStatusBadge } from "@/components/withdrawal-status-badge";

import {
  WithdrawalDetailSheet,
  type WithdrawalDetailData,
} from "@/components/withdrawal-detail-sheet";

type Props = {
  focus?: Id<"withdrawals"> | undefined;
  onFocusHandled?: () => void;
};

/**
 * List of the viewer's past withdrawal requests. Row click opens the shared
 * detail sheet. If a `focus` id is supplied the sheet opens once for that
 * withdrawal — used by /user/withdrawals?requestId=… after a fresh request.
 */
export function WithdrawalList({ focus, onFocusHandled }: Props) {
  const withdrawalsQ = useSuspenseQuery(
    convexQuery(api.withdrawals.listMine, {}),
  );
  const rows = withdrawalsQ.data;

  const [selectedId, setSelectedId] = useState<Id<"withdrawals"> | null>(
    focus ?? null,
  );
  const [detailOpen, setDetailOpen] = useState<boolean>(focus != null);

  // Re-open the sheet whenever a fresh `focus` id arrives via the URL search
  // param (typically after submitting a new request). Runs post-render to
  // avoid React's "state update during render" warning under StrictMode.
  useEffect(() => {
    if (focus != null && selectedId !== focus) {
      setSelectedId(focus);
      setDetailOpen(true);
    }
  }, [focus, selectedId]);

  if (rows.length === 0) {
    return (
      <div className="mx-5 mt-4 rounded-[18px] border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-dim">
          <Icon name="clock" size={22} color="var(--primary)" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          No withdrawals yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your first withdrawal request will appear here.
        </p>
      </div>
    );
  }

  const selectedRow = rows.find((r) => r._id === selectedId) ?? null;
  const detail: WithdrawalDetailData | null =
    selectedRow != null
      ? {
          _id: selectedRow._id,
          reference: selectedRow.reference,
          requested_amount_kobo: selectedRow.requested_amount_kobo,
          status: selectedRow.status,
          requested_at: selectedRow.requested_at,
          approved_at: selectedRow.approved_at ?? undefined,
          processed_at: selectedRow.processed_at ?? undefined,
          rejection_reason: selectedRow.rejection_reason ?? undefined,
          payout_provider: selectedRow.payout_provider ?? undefined,
          payout_reference: selectedRow.payout_reference ?? undefined,
          last_processing_error: selectedRow.last_processing_error ?? undefined,
          bank_account:
            selectedRow.bank_account != null
              ? {
                  bank_name: selectedRow.bank_account.bank_name,
                  account_number_last4:
                    selectedRow.bank_account.account_number_last4 ?? undefined,
                  account_name:
                    selectedRow.bank_account.account_name ?? undefined,
                }
              : undefined,
        }
      : null;

  return (
    <div className="mx-5 mt-4 rounded-[18px] border border-border bg-card px-4">
      {rows.map((wd, i) => (
        <button
          key={wd._id}
          type="button"
          onClick={() => {
            setSelectedId(wd._id);
            setDetailOpen(true);
          }}
          className={`flex w-full items-center gap-3.5 py-4 text-left transition-colors hover:bg-secondary/60 ${
            i < rows.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-primary-dim">
            <Icon
              name="arrow-up-right"
              size={18}
              color="var(--primary)"
              strokeWidth={2}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 truncate text-sm font-medium text-foreground">
              {wd.bank_account?.bank_name ?? "Withdrawal"}
              {wd.bank_account?.account_number_last4 != null && (
                <span className="ml-2 text-xs text-muted-foreground">
                  •••• {wd.bank_account.account_number_last4}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(wd.requested_at).toLocaleString("en-NG", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="text-sm font-bold text-foreground">
              {formatNaira(wd.requested_amount_kobo)}
            </div>
            <WithdrawalStatusBadge status={wd.status} />
          </div>
        </button>
      ))}
      <WithdrawalDetailSheet
        withdrawal={detail}
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) {
            setSelectedId(null);
            onFocusHandled?.();
          }
        }}
      />
    </div>
  );
}
