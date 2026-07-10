import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { toast } from "@avm-daily/ui/components/sonner";
import {
  formatNaira,
  formatNairaCompact,
  nairaToKobo,
} from "@avm-daily/application/client";
import { api } from "@avm-daily/backend/convex/_generated/api";
import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import { Button } from "@avm-daily/ui/components/button";
import { Input } from "@avm-daily/ui/components/input";
import { Field, FieldLabel } from "@avm-daily/ui/components/field";
import { cn } from "@avm-daily/ui/lib/utils";

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000] as const;

/**
 * Top-up form for a single plan. Mirrors the design's `DepositScreen` amount
 * step: centered ₦ + big input + quick-amount pills + primary CTA. Runs on
 * its own route so the plan detail stays a read view.
 */
export function PlanTopUpForm({
  planId,
}: {
  planId: Id<"user_savings_plans">;
}) {
  const navigate = useNavigate();
  const planQ = useSuspenseQuery(
    convexQuery(api.savingsPlans.get, { planId }),
  );
  const availableQ = useSuspenseQuery(
    convexQuery(api.users.availableForWithdrawal, {}),
  );

  const plan = planQ.data;
  const availableKobo = availableQ.data.availableKobo;
  const planIsActive = plan.status === "active";

  const topUp = useMutation(api.savingsPlans.topUp);
  const [amountNaira, setAmountNaira] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = Number.parseFloat(amountNaira.replace(/,/g, ""));
  const amountKobo =
    Number.isFinite(parsed) && parsed > 0 ? nairaToKobo(parsed) : 0n;

  const overAvailable = amountKobo > availableKobo;
  const canSubmit =
    planIsActive && amountKobo > 0n && !overAvailable && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const reference =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `topup_${crypto.randomUUID()}`
          : `topup_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await topUp({
        planId,
        amountKobo,
        reference,
        note: note.trim() || undefined,
      });
      toast.success(`${formatNaira(amountKobo)} added to your goal`);
      void navigate({
        to: "/user/plans/$planId" as string,
        params: { planId },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Top-up could not be completed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-5 my-4 flex flex-col gap-6 pb-8">
      <div className="rounded-[18px] border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Topping up</div>
        <div className="text-[15px] font-bold text-foreground">
          {plan.template_snapshot?.name ?? "Savings goal"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Current {formatNairaCompact(plan.current_amount_kobo)} · Available
          balance {formatNaira(availableKobo)}
        </div>
      </div>

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
              // Allow digits + at most one decimal point.
              const sanitized = e.target.value
                .replace(/[^0-9.]/g, "")
                .replace(/(\..*)\./g, "$1");
              setAmountNaira(sanitized);
            }}
            className="w-[180px] border-0 bg-transparent p-0 text-center font-display text-[42px] font-bold caret-primary shadow-none focus-visible:ring-0"
          />
        </div>
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
        {!planIsActive && (
          <p className="mt-3 text-xs text-warning">
            This plan is {plan.status} — resume it before topping up.
          </p>
        )}
      </section>

      <Field>
        <FieldLabel>Add a note (optional)</FieldLabel>
        <Input
          type="text"
          maxLength={140}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Extra savings for Q4"
        />
      </Field>

      <Button
        variant="primary"
        size="hero"
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="w-full"
      >
        {submitting ? "Confirming…" : "Confirm top-up"}
      </Button>
    </div>
  );
}
