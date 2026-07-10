import { Suspense } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Icon } from "@avm-daily/ui/components/icon";
import { Skeleton } from "@avm-daily/ui/components/skeleton";

import { NotificationPreferencesForm } from "@/components/notification-preferences-form";

/**
 * /user/notifications/preferences — channel + category toggles. Extrapolated
 * screen (design source doesn't cover it) using existing tokens + Checkbox.
 */
export const Route = createFileRoute(
  "/_protected/user/notifications/preferences",
)({
  component: NotificationPreferencesPage,
});

function NotificationPreferencesPage() {
  return (
    <div className="screen-anim pb-10">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <Link
          to="/user/notifications"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Back to inbox"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Notification preferences
          </h2>
          <p className="text-sm text-muted-foreground">
            Tell us how you'd like to be reached. Delivery routing is rolling
            out — saved choices take effect once we ship the notifier update.
          </p>
        </div>
      </header>

      <Suspense fallback={<FormSkeleton />}>
        <NotificationPreferencesForm />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-5 my-4 flex flex-col gap-6">
      <Skeleton className="h-64 w-full rounded-[18px]" />
      <Skeleton className="h-96 w-full rounded-[18px]" />
      <Skeleton className="h-12 w-full rounded-[14px]" />
    </div>
  );
}
