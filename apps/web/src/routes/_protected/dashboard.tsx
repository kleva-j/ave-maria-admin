import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@avm-daily/ui/components/card";

export const Route = createFileRoute("/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    user,
    sessionId,
    organizationId,
    role,
    roles,
    permissions,
    loading,
  } = useAuth();

  if (loading) {
    return <div className="p-6">Loading session...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-medium">User:</span>{" "}
            {user?.email ?? user?.id ?? "Unknown"}
          </div>
          <div>
            <span className="font-medium">Session ID:</span>{" "}
            {sessionId ?? "Unavailable"}
          </div>
          <div>
            <span className="font-medium">Organization:</span>{" "}
            {organizationId ?? "None"}
          </div>
          <div>
            <span className="font-medium">Role:</span> {role ?? "None"}
          </div>
          <div>
            <span className="font-medium">Roles:</span>{" "}
            {roles?.length ? roles.join(", ") : "None"}
          </div>
          <div>
            <span className="font-medium">Permissions:</span>{" "}
            {permissions?.length ? permissions.join(", ") : "None"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
