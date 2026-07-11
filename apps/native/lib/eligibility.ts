import { useQuery } from "convex/react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import {
  computeEligibility,
  type Eligibility,
} from "@avm-daily/application/client";

/**
 * Native mirror of `apps/web/src/lib/eligibility.ts`. Uses `useQuery` from
 * `convex/react` (no Suspense on RN). Returns `undefined` fields while
 * queries resolve — callers should gate on `isReady`.
 */
export function useEligibility(): Eligibility & { isReady: boolean } {
  const viewer = useQuery(api.users.viewer, {});
  const banks = useQuery(api.bankAccounts.listMineMasked, {});

  const isReady = viewer !== undefined && banks !== undefined;
  const eligibility = computeEligibility({
    user: viewer ?? null,
    bankAccounts: banks ?? null,
  });

  return { ...eligibility, isReady };
}
