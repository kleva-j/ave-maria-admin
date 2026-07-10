import { useMutation } from "convex/react";
import { useState } from "react";

import { Field, FieldLabel } from "@avm-daily/ui/components/field";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Button } from "@avm-daily/ui/components/button";
import { toast } from "@avm-daily/ui/components/sonner";
import { Input } from "@avm-daily/ui/components/input";

/**
 * Inline "Link new bank account" form. Matches the design's collapse-to-form
 * pattern on `BanksScreen`. Two required fields (bank + account number) and
 * one optional (account name). Primary-flag is decided server-side (first
 * account is auto-primary).
 */
export function BankAccountAddForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.bankAccounts.create);

  const validAccount = /^\d{10}$/.test(accountNumber);
  const canSubmit =
    bankName.trim().length > 0 && validAccount && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await create({
        bank_name: bankName.trim(),
        account_number: accountNumber,
        account_name: accountName.trim() || undefined,
      });
      toast.success("Bank account linked");
      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not link the account",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-up rounded-[18px] border border-border bg-card p-5">
      <div className="mb-4 text-[15px] font-bold text-foreground">
        Link new account
      </div>
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel>Bank</FieldLabel>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="GTBank"
          />
        </Field>
        <Field>
          <FieldLabel>Account number</FieldLabel>
          <Input
            value={accountNumber}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) =>
              setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="10-digit NUBAN"
          />
          {accountNumber.length > 0 && !validAccount && (
            <p className="mt-1 text-xs text-destructive">
              Account number must be 10 digits.
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel>Account name (optional)</FieldLabel>
          <Input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="As shown on your bank statement"
          />
        </Field>
      </div>
      <div className="mt-5 flex gap-2.5">
        <Button
          variant="primary"
          size="md"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="flex-1"
        >
          {submitting ? "Linking…" : "Link account"}
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={submitting}
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
