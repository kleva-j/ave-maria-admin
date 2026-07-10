import type { Doc } from "@avm-daily/backend/convex/_generated/dataModel";
import {
  formatNaira,
  TXN_KIND_BY_TYPE,
  TXN_TYPE_LABEL,
  TxnKind,
  txnAmountPrefix,
} from "@avm-daily/application/client";
import { Icon } from "@avm-daily/ui/components/icon";
import { cn } from "@avm-daily/ui/lib/utils";

/**
 * Single row in the transaction list. Left icon (arrow direction) is coloured
 * by kind (credit vs debit); right amount is signed and coloured the same.
 * Matches the design's `HistoryScreen` list row.
 */
export type TransactionRowData = Pick<
  Doc<"transactions">,
  "_id" | "type" | "amount_kobo" | "reference" | "created_at"
> & {
  user_plan_id?: Doc<"transactions">["user_plan_id"] | undefined;
};

export function TransactionRow({
  tx,
  onClick,
  divider,
}: {
  tx: TransactionRowData;
  onClick?: () => void;
  divider: boolean;
}) {
  const kind = TXN_KIND_BY_TYPE[tx.type] ?? TxnKind.DEBIT;
  const isCredit = kind === TxnKind.CREDIT;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-[10px] py-3.5 text-left",
        divider && "border-b border-border",
        "transition-colors hover:bg-secondary/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
      )}
    >
      <div
        className={cn(
          "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px]",
          isCredit ? "bg-success-dim" : "bg-destructive-dim",
        )}
      >
        <Icon
          name={isCredit ? "arrow-down-left" : "arrow-up-right"}
          size={18}
          color={isCredit ? "var(--success)" : "var(--destructive)"}
          strokeWidth={2}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 truncate text-sm font-medium text-foreground">
          {TXN_TYPE_LABEL[tx.type] ?? tx.type}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {new Date(tx.created_at).toLocaleString("en-NG", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          <span className="ml-2 text-[color:var(--subtle)]">
            · {tx.reference.slice(0, 12)}…
          </span>
        </div>
      </div>
      <div
        className={cn(
          "shrink-0 text-right text-sm font-bold",
          isCredit ? "text-success" : "text-foreground",
        )}
      >
        {txnAmountPrefix(kind)}
        {formatNaira(tx.amount_kobo)}
      </div>
    </button>
  );
}
