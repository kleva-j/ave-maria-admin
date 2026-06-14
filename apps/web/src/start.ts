import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";
import { createStart } from "@tanstack/react-start";

// Sentry middleware must be first in each array so it observes the full
// request / function lifecycle (including downstream middleware failures).
// Both middleware are no-ops when SENTRY_DSN is unset.
export const startInstance = createStart(() => ({
  requestMiddleware: [sentryGlobalRequestMiddleware, authkitMiddleware()],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
