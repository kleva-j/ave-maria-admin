import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import {
  formatNaira,
  TXN_KIND_BY_TYPE,
  TXN_TYPE_LABEL,
  TxnKind,
  txnAmountPrefix,
} from "@avm-daily/application/client";
import { Icon } from "@avm-daily/ui/components/icon";
import { Badge } from "@avm-daily/ui/components/badge";
import {
  Sheet,
  SheetClose,
  SheetTitle,
  SheetHeader,
  SheetContent,
  SheetDescription,
} from "@avm-daily/ui/components/sheet";
import { cn } from "@avm-daily/ui/lib/utils";

/**
 * Slide-in detail drawer for a single transaction. Consumes the shared
 * `Sheet` primitive from packages/ui.
 *
 * Surfaces amount + type + reference + timestamp + reversal chain if present.
 */

export type TransactionDetail = {
  _id: Id<"transactions">;
  user_id: Id<"users">;
  user_plan_id?: Id<"user_savings_plans"> | undefined;
  type: string;
  amount_kobo: bigint;
  reference: string;
  reversal_of_transaction_id?: Id<"transactions"> | undefined;
  reversal_of_reference?: string | undefined;
  reversal_of_type?: string | undefined;
  created_at: number;
};

export function TransactionDetailSheet({
  tx,
  open,
  onOpenChange,
}: {
  tx: TransactionDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-theme="midnight" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Transaction detail</SheetTitle>
          <SheetClose aria-label="Close">
            <Icon name="x" size={16} />
          </SheetClose>
        </SheetHeader>
        {tx == null ? (
          <SheetDescription>
            <p className="text-sm text-muted-foreground">
              No transaction selected.
            </p>
          </SheetDescription>
        ) : (
          <TxBody tx={tx} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TxBody({ tx }: { tx: TransactionDetail }) {
  const kind = TXN_KIND_BY_TYPE[tx.type] ?? TxnKind.DEBIT;
  const isCredit = kind === TxnKind.CREDIT;

  const rows: Array<[string, string]> = [
    ["Type", TXN_TYPE_LABEL[tx.type] ?? tx.type],
    ["Reference", tx.reference],
    [
      "Posted",
      new Date(tx.created_at).toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    ],
  ];
  if (tx.reversal_of_reference != null) {
    rows.push(["Reverses reference", tx.reversal_of_reference]);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="mb-6 rounded-[18px] border border-border bg-secondary/40 p-5 text-center">
        <div
          className={cn(
            "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full",
            isCredit ? "bg-success-dim" : "bg-destructive-dim",
          )}
        >
          <Icon
            name={isCredit ? "arrow-down-left" : "arrow-up-right"}
            size={22}
            color={isCredit ? "var(--success)" : "var(--destructive)"}
            strokeWidth={2}
          />
        </div>
        <div
          className={cn(
            "font-display text-3xl font-bold",
            isCredit ? "text-success" : "text-foreground",
          )}
        >
          {txnAmountPrefix(kind)}
          {formatNaira(tx.amount_kobo)}
        </div>
        <div className="mt-2 flex justify-center">
          <Badge variant={isCredit ? "success" : "default"}>
            {isCredit ? "Credit" : "Debit"}
          </Badge>
        </div>
      </div>

      <dl className="flex flex-col gap-3.5">
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
    </div>
  );
}
