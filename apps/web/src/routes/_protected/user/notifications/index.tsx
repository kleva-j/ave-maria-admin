import { Suspense } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Inbox, InboxContent } from "@novu/react";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Icon } from "@avm-daily/ui/components/icon";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Button } from "@avm-daily/ui/components/button";

/**
 * /user/notifications — full-page Novu inbox. Design (NotificationsScreen in
 * avm-screens-3.jsx) is honoured through Novu's default inbox chrome; the
 * secure-mode `subscriberHash` is generated server-side by
 * userNotifications.getNovuInboxAuth (Convex fn).
 *
 * If Novu isn't configured (NOVU_SECRET_KEY unset), the query returns null
 * and we render a friendly stub so signed-in users don't hit a broken UI.
 */
export const Route = createFileRoute("/_protected/user/notifications/")({
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <div className="screen-anim pb-8">
      <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Notifications
          </h2>
          <p className="text-sm text-muted-foreground">
            Every important thing about your account, in one place.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          render={
            <Link to="/user/notifications/preferences">
              <Icon name="settings" size={16} />
              Preferences
            </Link>
          }
        />
      </header>

      <Suspense fallback={<InboxSkeleton />}>
        <InboxBody />
      </Suspense>
    </div>
  );
}

function InboxBody() {
  const authQ = useSuspenseQuery(
    convexQuery(api.userNotifications.getNovuInboxAuth, {}),
  );
  const auth = authQ.data;
  const appId = import.meta.env.VITE_NOVU_APP_ID as string | undefined;

  if (auth == null || !appId) {
    return (
      <div className="mx-5 mt-4 rounded-[18px] border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
          <Icon name="bell" size={22} color="var(--subtle)" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Notifications are off
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The delivery provider isn't configured for this environment yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-5 mt-4 overflow-hidden rounded-[18px] border border-border bg-card"
      style={{ minHeight: 480 }}
    >
      <Inbox
        applicationIdentifier={appId}
        subscriber={{
          subscriberId: auth.subscriberId,
        }}
        subscriberHash={auth.subscriberHash}
      >
        <InboxContent hideNav />
      </Inbox>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-[16px]" />
      ))}
    </div>
  );
}
