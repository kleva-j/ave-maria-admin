import { Badge } from "@avm-daily/ui/components/badge";
import {
  BANK_VERIFY_STATUS_VARIANT,
  BANK_VERIFY_STATUS_LABEL,
} from "@avm-daily/application/client";

/**
 * Small badge that maps a bank account's `verification_status` to the
 * shared label/variant maps. `manual_override` (rare) falls back to
 * "verified" variant to keep the visual grammar consistent.
 */
export function BankVerificationBadge({ status }: { status: string }) {
  // Normalise `manual_override` to the same label users see for a regular
  // verify — the underscored form is an internal detail that shouldn't leak
  // into the UI.
  const label =
    BANK_VERIFY_STATUS_LABEL[status] ??
    (status === "manual_override" ? "Verified" : status);
  const variant =
    BANK_VERIFY_STATUS_VARIANT[status] ??
    (status === "manual_override" ? "success" : "default");
  return <Badge variant={variant}>{label}</Badge>;
}
