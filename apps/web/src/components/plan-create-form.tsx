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
import { Icon } from "@avm-daily/ui/components/icon";
import { Input } from "@avm-daily/ui/components/input";
import { Field, FieldLabel } from "@avm-daily/ui/components/field";
import { cn } from "@avm-daily/ui/lib/utils";

/**
 * Plan-create form — extrapolated from the design's step pattern (used by
 * `DepositScreen`): pick a template, then set the target and confirm.
 *
 * Two steps rendered inline on the same route rather than as separate URLs —
 * the state flow is short and the design's onboarding pattern keeps it
 * single-scroll.
 */
export function PlanCreateForm() {
  const navigate = useNavigate();
  const templatesQ = useSuspenseQuery(
    convexQuery(api.savingsPlanTemplates.listActive, {}),
  );
  const templates = templatesQ.data;

  const create = useMutation(api.savingsPlans.create);

  const [templateId, setTemplateId] = useState<Id<"savings_plan_templates"> | null>(null);
  const [targetNaira, setTargetNaira] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selected = templates.find((t) => t._id === templateId);
  const defaultTargetNaira =
    selected != null ? Number(selected.default_target_kobo) / 100 : 0;
  const parsedTarget = Number.parseFloat(targetNaira.replace(/,/g, ""));
  const targetKobo =
    Number.isFinite(parsedTarget) && parsedTarget > 0
      ? nairaToKobo(parsedTarget)
      : selected?.default_target_kobo ?? 0n;

  const canSubmit = selected != null && targetKobo > 0n && !submitting;

  const handleCreate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const plan = await create({
        templateId: selected._id,
        customTargetKobo: targetKobo,
      });
      toast.success("Goal created");
      void navigate({
        to: "/user/plans/$planId" as string,
        params: { planId: plan._id },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create the goal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-5 my-4 flex flex-col gap-6 pb-6">
      <section>
        <h4 className="mb-3 text-[15px] font-bold text-foreground">
          Choose a plan template
        </h4>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {templates.map((t) => {
            const selectedThis = t._id === templateId;
            return (
              <button
                key={t._id}
                type="button"
                onClick={() => {
                  setTemplateId(t._id);
                  setTargetNaira("");
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-[18px] border-[1.5px] bg-card p-4 text-left transition-colors",
                  selectedThis
                    ? "border-primary"
                    : "border-border hover:border-[color-mix(in_oklab,var(--primary)_60%,transparent)]",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-[12px]",
                      selectedThis ? "bg-primary-dim" : "bg-secondary",
                    )}
                  >
                    <Icon
                      name="target"
                      size={20}
                      color={selectedThis ? "var(--primary)" : "var(--muted-foreground)"}
                    />
                  </span>
                  <div className="flex-1">
                    <div className="text-[15px] font-bold text-foreground">
                      {t.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.duration_days} days · {(t.interest_rate * 100).toFixed(1)}%
                      interest
                    </div>
                  </div>
                </div>
                {t.description != null && (
                  <p className="text-xs leading-[1.5] text-muted-foreground">
                    {t.description}
                  </p>
                )}
                <div className="text-xs text-[color:var(--subtle)]">
                  Default target {formatNairaCompact(t.default_target_kobo)}
                </div>
              </button>
            );
          })}
        </div>
        {templates.length === 0 && (
          <p className="rounded-[18px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No active templates. Ask an admin to publish one.
          </p>
        )}
      </section>

      {selected && (
        <section className="fade-up">
          <h4 className="mb-3 text-[15px] font-bold text-foreground">
            Set your target
          </h4>
          <Field>
            <FieldLabel>Target amount</FieldLabel>
            <div className="flex items-center gap-2 rounded-[14px] border border-border bg-input px-4 py-3">
              <span className="font-display text-lg font-semibold text-muted-foreground">
                ₦
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder={defaultTargetNaira.toLocaleString("en-NG")}
                value={targetNaira}
                onChange={(e) => {
                  // Allow digits + at most one decimal point.
                  const sanitized = e.target.value
                    .replace(/[^0-9.]/g, "")
                    .replace(/(\..*)\./g, "$1");
                  setTargetNaira(sanitized);
                }}
                className="border-0 bg-transparent p-0 text-lg shadow-none focus-visible:ring-0"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Default: {formatNaira(selected.default_target_kobo)}. Adjust if
              your goal is different.
            </p>
          </Field>
          <Button
            variant="primary"
            size="hero"
            onClick={() => void handleCreate()}
            disabled={!canSubmit}
            className="mt-6 w-full"
          >
            Create goal
          </Button>
        </section>
      )}
    </div>
  );
}
