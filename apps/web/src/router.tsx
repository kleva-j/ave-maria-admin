import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { env } from "@avm-daily/env/web";

import { routeTree } from "./routeTree.gen";

import Loader from "./components/loader";

import "./index.css";

export function getRouter() {
  const convexUrl = env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is not set");
  }

  const convexQueryClient = new ConvexQueryClient(convexUrl);

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });

  // Connect the Convex query client to the TanStack Query client
  convexQueryClient.connect(queryClient);

  // Create the TanStack Router
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    context: { queryClient, convexQueryClient },
  });

  // Connect the TanStack Router to the TanStack Query client
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
