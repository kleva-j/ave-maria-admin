import { useState } from "react";
import { useMutation } from "convex/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { toast } from "@avm-daily/ui/components/sonner";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Button } from "@avm-daily/ui/components/button";
import { Checkbox } from "@avm-daily/ui/components/checkbox";
import { Separator } from "@avm-daily/ui/components/separator";

/**
 * Notification preferences form. Extrapolated composition (design covers
 * inbox but not this preferences screen) using existing tokens + Checkbox
 * primitive.
 *
 * Two axes:
 *  - Channels: In-app / Email / SMS / Push
 *  - Categories: derived from the seven backend NotificationEventType values
 *    that end up in the user inbox (see userNotifications.ts USER_FACING_EVENT_TYPES).
 *
 * Server persists to users.notification_preferences. Novu subscriber-preferences
 * sync is a follow-up ticket noted in the commit body — for now this only
 * captures user intent.
 */

const CATEGORY_ORDER = [
  {
    id: "withdrawal_approved",
    label: "Withdrawal approved",
    hint: "Your withdrawal has been reviewed and approved.",
  },
  {
    id: "withdrawal_rejected",
    label: "Withdrawal rejected",
    hint: "Something went wrong — we couldn't approve the request.",
  },
  {
    id: "withdrawal_processed",
    label: "Withdrawal processed",
    hint: "Funds have left your wallet on their way to your bank.",
  },
  {
    id: "withdrawal_processing_failed",
    label: "Withdrawal failed",
    hint: "The payout provider rejected the transfer — please review.",
  },
  {
    id: "kyc_decision_applied",
    label: "KYC decision",
    hint: "We finished reviewing your identity documents.",
  },
  {
    id: "bank_verification_approved",
    label: "Bank verification approved",
    hint: "A bank account is verified and ready to use.",
  },
  {
    id: "bank_verification_rejected",
    label: "Bank verification rejected",
    hint: "One of your bank verifications was rejected.",
  },
] as const;

const CHANNELS = [
  {
    key: "inApp" as const,
    label: "In-app inbox",
    hint: "Show notifications in the AVM Daily inbox.",
  },
  {
    key: "email" as const,
    label: "Email",
    hint: "Send an email for each outcome we notify you about.",
  },
  {
    key: "sms" as const,
    label: "SMS",
    hint: "Text the important ones to your phone.",
  },
  {
    key: "push" as const,
    label: "Push",
    hint: "Push to a paired mobile device or the browser.",
  },
];

export function NotificationPreferencesForm() {
  const prefsQ = useSuspenseQuery(
    convexQuery(api.userNotifications.getPreferences, {}),
  );
  const update = useMutation(api.userNotifications.updatePreferences);

  // Seed local state from the initial query result. Convex's live
  // subscription would push future changes into `prefsQ.data`, but we
  // deliberately do NOT re-sync — that would clobber in-progress edits when
  // React Query refetches (e.g. window focus). "Save preferences" is the
  // only way state moves back to the server.
  const [inApp, setInApp] = useState<boolean>(prefsQ.data.inApp);
  const [email, setEmail] = useState<boolean>(prefsQ.data.email);
  const [sms, setSms] = useState<boolean>(prefsQ.data.sms);
  const [push, setPush] = useState<boolean>(prefsQ.data.push);
  const [categories, setCategories] = useState<Record<string, boolean>>(
    prefsQ.data.categories,
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      // Backend treats the map as sparse — `undefined` means enabled.
      // Only serialise categories the user explicitly turned OFF so the
      // stored map doesn't grow with every save.
      const disabled: Record<string, boolean> = {};
      for (const [id, on] of Object.entries(categories)) {
        if (on === false) disabled[id] = false;
      }
      await update({
        preferences: {
          inApp,
          email,
          sms,
          push,
          categories: disabled,
        },
      });
      toast.success("Preferences saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save preferences",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-5 my-4 flex flex-col gap-6 pb-8">
      <section>
        <h4 className="mb-1 text-[15px] font-bold text-foreground">Channels</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Pick where we should reach you when something needs your attention.
        </p>
        <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4">
          {CHANNELS.map((c, i) => {
            const value = { inApp, email, sms, push }[c.key];
            const setValue = { inApp: setInApp, email: setEmail, sms: setSms, push: setPush }[
              c.key
            ];
            return (
              <div key={c.key}>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={value}
                    onCheckedChange={(v) => setValue(v === true)}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {c.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {c.hint}
                    </span>
                  </span>
                </label>
                {i < CHANNELS.length - 1 && (
                  <Separator className="mt-3 opacity-70" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="mb-1 text-[15px] font-bold text-foreground">
          Categories
        </h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Turn off the ones you don't care about. Delivery routing is being
          rolled out — your saved choices will take effect once the notifier
          integration ships.
        </p>
        <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4">
          {CATEGORY_ORDER.map((cat, i) => {
            const value = categories[cat.id] ?? true;
            return (
              <div key={cat.id}>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={value}
                    onCheckedChange={(v) =>
                      setCategories((prev) => ({
                        ...prev,
                        [cat.id]: v === true,
                      }))
                    }
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {cat.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {cat.hint}
                    </span>
                  </span>
                </label>
                {i < CATEGORY_ORDER.length - 1 && (
                  <Separator className="mt-3 opacity-70" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Button
        variant="primary"
        size="hero"
        disabled={saving}
        onClick={() => void submit()}
        className="w-full"
      >
        {saving ? "Saving…" : "Save preferences"}
      </Button>
    </div>
  );
}
