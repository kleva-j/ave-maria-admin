import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";

import {
  computeEligibility,
  type Eligibility,
} from "@avm-daily/application/client";

/**
 * Web hook — subscribes to `users.viewer` + `bankAccounts.listMineMasked`
 * and delegates the pure eligibility rules to
 * `packages/application/src/client/eligibility.ts`.
 *
 * Always call inside a `<Suspense>` boundary — this uses
 * `useSuspenseQuery` on both queries.
 */
export function useEligibility(): Eligibility {
  const viewer = useSuspenseQuery(convexQuery(api.users.viewer, {}));
  const banks = useSuspenseQuery(
    convexQuery(api.bankAccounts.listMineMasked, {}),
  );

  return computeEligibility({
    user: viewer.data ?? null,
    bankAccounts: banks.data ?? null,
  });
}
