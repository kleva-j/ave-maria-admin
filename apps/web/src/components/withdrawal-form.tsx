import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";

import { Field, FieldLabel } from "@avm-daily/ui/components/field";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Button } from "@avm-daily/ui/components/button";
import { toast } from "@avm-daily/ui/components/sonner";
import { Input } from "@avm-daily/ui/components/input";
import { Icon } from "@avm-daily/ui/components/icon";
import { cn } from "@avm-daily/ui/lib/utils";

import {
  formatNairaCompact,
  formatNaira,
  nairaToKobo,
} from "@avm-daily/application/client";

import { useEligibility } from "@/lib/eligibility";

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000] as const;

/**
 * Two-step withdrawal form. Follows the design's `DepositScreen` withdrawal
 * tab: centered ₦ input + quick amounts, verified-bank picker, confirm
 * step, then success handoff back to the list.
 *
 * Server re-validates every check (KYC, primary bank, available balance,
 * risk holds) — the client checks are only for UX.
 */
export function WithdrawalForm() {
  const navigate = useNavigate();
  const eligibility = useEligibility();

  const banksQ = useSuspenseQuery(
    convexQuery(api.bankAccounts.listMineMasked, {}),
  );
  const availableQ = useSuspenseQuery(
    convexQuery(api.users.availableForWithdrawal, {}),
  );
  const request = useMutation(api.withdrawals.request);

  const verified = banksQ.data.filter(
    (b) => b.verification_status === "verified",
  );
  const availableKobo = availableQ.data.availableKobo;

  const [amountNaira, setAmountNaira] = useState("");
  const [bankId, setBankId] = useState<Id<"user_bank_accounts"> | null>(
    verified.find((b) => b.is_primary)?._id ?? verified[0]?._id ?? null,
  );
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);

  const parsed = Number.parseFloat(amountNaira.replace(/,/g, ""));
  const amountKobo =
    Number.isFinite(parsed) && parsed > 0 ? nairaToKobo(parsed) : 0n;
  const overAvailable = amountKobo > availableKobo;

  const canProceed =
    eligibility.canWithdraw &&
    bankId != null &&
    amountKobo > 0n &&
    !overAvailable;

  if (!eligibility.canWithdraw) {
    return <IneligibleState reason={eligibility.reason} />;
  }
  if (verified.length === 0) {
    return <NoVerifiedBankState />;
  }

  const selectedBank = verified.find((b) => b._id === bankId);

  if (step === "confirm" && selectedBank) {
    return (
      <ConfirmStep
        amountKobo={amountKobo}
        bank={selectedBank}
        submitting={submitting}
        onBack={() => setStep("form")}
        onConfirm={async () => {
          setSubmitting(true);
          try {
            const wd = await request({
              amount_kobo: amountKobo,
              method: "bank_transfer",
              bank_account_id: selectedBank._id,
            });
            toast.success("Withdrawal request submitted");
            navigate({
              to: "/user/withdrawals" as string,
              search: { requestId: wd._id },
              replace: true,
            });
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Could not submit withdrawal",
            );
          } finally {
            setSubmitting(false);
          }
        }}
      />
    );
  }

  return (
    <div className="mx-5 my-4 flex flex-col gap-6 pb-8">
      <section className="text-center">
        <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Amount
        </p>
        <div className="flex items-center justify-center gap-1.5">
          <span className="font-display text-3xl font-semibold text-muted-foreground">
            ₦
          </span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amountNaira}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              setAmountNaira(raw);
            }}
            className="w-45 border-0 bg-transparent p-0 text-center font-display text-[42px] font-bold caret-primary shadow-none focus-visible:ring-0"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Available {formatNaira(availableKobo)}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setAmountNaira(amt.toLocaleString())}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
                parsed === amt
                  ? "border-transparent bg-primary-dim text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {formatNairaCompact(amt * 100)}
            </button>
          ))}
        </div>
        {overAvailable && (
          <p className="mt-3 text-xs text-destructive">
            Amount exceeds available balance ({formatNaira(availableKobo)}).
          </p>
        )}
      </section>

      <Field>
        <FieldLabel>Withdraw to</FieldLabel>
        <div className="flex flex-col gap-2.5">
          {verified.map((bank) => {
            const selectedThis = bank._id === bankId;
            return (
              <button
                key={bank._id}
                type="button"
                onClick={() => setBankId(bank._id)}
                className={cn(
                  "flex items-center gap-3.5 rounded-[14px] border-[1.5px] bg-card p-4 text-left transition-colors",
                  selectedThis
                    ? "border-primary"
                    : "border-border hover:border-[color-mix(in_oklab,var(--primary)_60%,transparent)]",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-dim">
                  <Icon name="building" size={18} color="var(--primary)" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {bank.bank_name}
                    {bank.is_primary && (
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-primary">
                        · Primary
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    •••• {bank.account_number_last4}
                    {bank.account_name != null && ` · ${bank.account_name}`}
                  </div>
                </div>
                {selectedThis && (
                  <Icon name="check-circle" size={20} color="var(--primary)" />
                )}
              </button>
            );
          })}
        </div>
      </Field>

      <Button
        variant="primary"
        size="hero"
        onClick={() => setStep("confirm")}
        disabled={!canProceed}
        className="w-full"
      >
        Review withdrawal
      </Button>
    </div>
  );
}

function ConfirmStep({
  amountKobo,
  bank,
  submitting,
  onBack,
  onConfirm,
}: {
  amountKobo: bigint;
  bank: {
    _id: Id<"user_bank_accounts">;
    bank_name: string;
    account_number_last4: string;
  };
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["To", `${bank.bank_name} · •••• ${bank.account_number_last4}`],
    ["Fee", "Free"],
    ["You receive", formatNaira(amountKobo)],
  ];

  return (
    <div className="mx-5 my-4 flex flex-col gap-4 pb-8">
      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className="border-b border-border pb-5 text-center">
          <p className="text-xs text-muted-foreground">You're withdrawing</p>
          <p className="mt-1 font-display-tight text-[34px] font-bold text-foreground">
            {formatNaira(amountKobo)}
          </p>
        </div>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={cn(
              "flex justify-between py-3.5",
              i < rows.length - 1 && "border-b border-border",
            )}
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-bold text-foreground">{value}</span>
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        size="hero"
        disabled={submitting}
        onClick={onConfirm}
        className="w-full"
      >
        {submitting ? "Submitting…" : "Confirm withdrawal"}
      </Button>
      <Button variant="ghost" size="md" onClick={onBack} className="w-full">
        Edit amount
      </Button>
    </div>
  );
}

function IneligibleState({ reason }: { reason: string }) {
  return (
    <div className="mx-5 my-4 rounded-[18px] border border-warning-dim bg-warning-dim p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-warning-dim">
        <Icon name="alert-circle" size={22} color="var(--warning)" />
      </div>
      <p className="text-sm font-semibold text-foreground">Not yet available</p>
      <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}

function NoVerifiedBankState() {
  return (
    <div className="mx-5 my-4 rounded-[18px] border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-dim">
        <Icon name="building" size={22} color="var(--primary)" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Add a verified bank first
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Withdrawals go to a bank account you've verified with us.
      </p>
    </div>
  );
}
