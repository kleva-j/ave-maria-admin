import { getAuth } from "@workos/authkit-tanstack-react-start";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  component: RouteComponent,
  loader: async ({ location }) => {
    const { user } = await getAuth();
    if (!user) {
      const returnTo = encodeURIComponent(
        `${location.pathname}${location.search}`,
      );
      throw redirect({ href: `/login?returnTo=${returnTo}` });
    }
    return { user };
  },
});

function RouteComponent() {
  return <Outlet />;
}
