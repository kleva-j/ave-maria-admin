import type { WithdrawalPayoutService } from "@avm-daily/application/ports";

export function createManualWithdrawalPayoutService(): WithdrawalPayoutService {
  return {
    async execute(input) {
      return {
        provider: "manual_ops",
        reference: `payout_${input.reference}`,
        metadata: {
          method: input.method,
        },
      };
    },
  };
}
