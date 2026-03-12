import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute(),
    },
  },
});
