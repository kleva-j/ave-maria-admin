import { Badge } from "@avm-daily/ui/components/badge";
import {
  WITHDRAWAL_STATUS_VARIANT,
  WITHDRAWAL_STATUS_LABEL,
} from "@avm-daily/application/client";

/**
 * Small badge that maps a withdrawal's backend status to the design's
 * warning/default/success/destructive palette. Copy pulled from the shared
 * `tx-format` module so a status rename lands in one place.
 */
export function WithdrawalStatusBadge({ status }: { status: string }) {
  const variant = WITHDRAWAL_STATUS_VARIANT[status] ?? "default";
  const label = WITHDRAWAL_STATUS_LABEL[status] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
