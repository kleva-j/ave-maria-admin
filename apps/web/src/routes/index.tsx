import { CalendarWidget } from "@avm-daily/ui/components/calendar-widget";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { ClockWidget } from "@avm-daily/ui/components/clock-widget";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  loader: async () => {
    return { signInUrl: await getSignInUrl() };
  },
  component: HomeComponent,
});

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

function HomeComponent() {
  const healthCheck = useQuery(convexQuery(api.healthCheck.get, {}));
  const { user, loading: authLoading } = useAuth();
  const { signInUrl } = Route.useLoaderData();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        {/* Auth Status Section */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Authentication</h2>
          {authLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : user ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  Signed in as{" "}
                  <span className="font-medium">
                    {user.email || user.firstName || "User"}
                  </span>
                </p>
              </div>
              <Link
                to="/signout"
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Sign Out
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">Not signed in</p>
              <a
                href={signInUrl}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign In
              </a>
            </div>
          )}
        </section>

        {/* API Status Section */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                healthCheck.data === "OK"
                  ? "bg-green-500"
                  : healthCheck.isLoading
                  ? "bg-orange-400"
                  : "bg-red-500"
              }`}
            />
            <span className="text-muted-foreground text-sm">
              {healthCheck.isLoading
                ? "Checking..."
                : healthCheck.data === "OK"
                ? "Connected"
                : "Error"}
            </span>
          </div>
        </section>
      </div>
      <div className="mt-4 flex gap-6">
        <ClockWidget />
        <CalendarWidget />
      </div>
    </div>
  );
}
