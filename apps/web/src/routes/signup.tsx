import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { startHostedSignUp } from "@/server/hosted-auth.functions";

export const Route = createFileRoute("/signup")({
  validateSearch: z.object({
    returnTo: z.string().optional(),
  }),
  loader: async ({ location }) => {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get("returnTo") ?? undefined;
    // Throws redirect to the WorkOS hosted sign-up page.
    await startHostedSignUp({ data: { returnTo } });
    return null;
  },
  component: () => null,
});
