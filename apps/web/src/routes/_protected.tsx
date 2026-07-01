import { getAuth } from "@workos/authkit-tanstack-react-start";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { PostHogIdentity } from "@/components/posthog-identity";
import { NotificationBell } from "@/components/notification-bell";

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
  return (
    <>
      <PostHogIdentity />
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <Link to="/dashboard" className="font-semibold">
            AVM Daily
          </Link>
          <NotificationBell />
        </header>
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </>
  );
}
