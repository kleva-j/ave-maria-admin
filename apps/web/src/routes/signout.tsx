import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/signout")({
  loader: async () => {
    throw new Response("Not Found", { status: 404 });
  },
});
