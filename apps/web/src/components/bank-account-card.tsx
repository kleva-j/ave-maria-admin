import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { toast } from "@avm-daily/ui/components/sonner";
import { Badge } from "@avm-daily/ui/components/badge";
import { Icon } from "@avm-daily/ui/components/icon";
import { cn } from "@avm-daily/ui/lib/utils";

import { BankVerificationBadge } from "@/components/bank-verification-badge";

/**
 * Reusable bank card matching the design's `BanksScreen` row: colored
 * building icon + name + primary badge + type + masked account, "Set as
 * primary" and "Remove" actions in a footer strip.
 *
 * The card content and the action buttons are separate interactive controls
 * (side-by-side rather than nested) so nested-interactive HTML is avoided
 * — the top section is a `<Link>` to the detail route; the footer buttons
 * live outside it.
 */
type Bank = {
  _id: Id<"user_bank_accounts">;
  bank_name: string;
  account_number_last4: string;
  account_name?: string | undefined;
  is_primary: boolean;
  verification_status: string;
};

const BANK_COLORS = ["#f97316", "#ef4444", "#7c5cfc", "#22c55e", "#3b7fff"];

function accentColor(name: string): string {
  const hash = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return BANK_COLORS[hash % BANK_COLORS.length]!;
}

export function BankAccountCard({ bank }: { bank: Bank }) {
  const setPrimary = useMutation(api.bankAccounts.setPrimary);
  const remove = useMutation(api.bankAccounts.remove);
  const accent = accentColor(bank.bank_name);

  const handlePrimary = async () => {
    try {
      await setPrimary({ account_id: bank._id });
      toast.success(`${bank.bank_name} is now your primary account`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not set as primary",
      );
    }
  };

  const handleRemove = async () => {
    const ok = window.confirm(
      `Remove ${bank.bank_name} •••• ${bank.account_number_last4}?`,
    );
    if (!ok) return;
    try {
      await remove({ account_id: bank._id });
      toast.success("Bank account removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not remove account",
      );
    }
  };

  return (
    <div
      className={cn(
        "rounded-[18px] border-[1.5px] bg-card p-5 transition-colors",
        bank.is_primary
          ? "border-[color-mix(in_oklab,var(--primary)_50%,transparent)]"
          : "border-border hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)]",
      )}
    >
      <Link
        to={"/user/banks/$bankId" as string}
        params={{ bankId: bank._id }}
        className="mb-3.5 flex items-center gap-3.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px]"
          style={{ background: `${accent}20` }}
        >
          <Icon name="building" size={21} color={accent} />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-foreground">
              {bank.bank_name}
            </span>
            {bank.is_primary && <Badge variant="default">Primary</Badge>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            •••• {bank.account_number_last4}
            {bank.account_name != null && ` · ${bank.account_name}`}
          </div>
        </div>
        <BankVerificationBadge status={bank.verification_status} />
      </Link>
      <div className="flex gap-2 border-t border-border pt-3">
        {!bank.is_primary && (
          <button
            type="button"
            onClick={() => void handlePrimary()}
            className="flex-1 rounded-[10px] bg-primary-dim px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Set as primary
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleRemove()}
          className={cn(
            "rounded-[10px] bg-destructive-dim px-3.5 py-2.5 text-xs font-semibold text-destructive transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            bank.is_primary && "flex-1",
          )}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
