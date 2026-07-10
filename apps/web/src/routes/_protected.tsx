import { getAuth } from "@workos/authkit-tanstack-react-start";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
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
  const pathname = useRouterState({
    select: ({ location }) => location.pathname,
  });

  // /_protected is the pathless parent of /dashboard, /admin/*, and /user/*.
  // Admin routes render their own chrome via AdminShell and user routes via
  // UserShell — the consumer top-bar + bell must not double-wrap either.
  const isShelfOwned =
    pathname.startsWith("/admin") || pathname.startsWith("/user");

  if (isShelfOwned) {
    return (
      <>
        <PostHogIdentity />
        <Outlet />
      </>
    );
  }

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
