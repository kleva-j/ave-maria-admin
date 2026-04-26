import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { DEFAULT_RETURN_PATH } from "@/lib/auth";
import { startHostedSignUp } from "@/server/hosted-auth.functions";

export const Route = createFileRoute("/signup")({
  validateSearch: z.object({
    returnTo: z.string().optional().default(DEFAULT_RETURN_PATH),
  }),
  loaderDeps: ({ search: { returnTo } }) => ({ returnTo }),
  loader: async ({ deps }) => {
    // Throws redirect to the WorkOS hosted sign-up page.
    await startHostedSignUp({ data: { returnTo: deps.returnTo } });
    return null;
  },
  component: () => null,
});
