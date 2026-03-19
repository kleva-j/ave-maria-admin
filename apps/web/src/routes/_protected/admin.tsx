import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { Button } from "@avm-daily/ui/components/button";
import { toast } from "@avm-daily/ui/components/sonner";

import { AdminShell } from "@/components/admin-shell";
import { isAdminRole } from "@/lib/admin-auth";

import {
  createFileRoute,
  useNavigate,
  redirect,
  Outlet,
} from "@tanstack/react-router";

import Loader from "@/components/loader";

export const Route = createFileRoute("/_protected/admin")({
  component: AdminLayout,
  loader: async ({ location }) => {
    const { user } = await getAuth();
    if (!user) {
      const returnTo = encodeURIComponent(
        `${location.pathname}${location.search}`,
      );
      throw redirect({ href: `/login?returnTo=${returnTo}` });
    }
    return null;
  },
});

function AdminLayout() {
  const navigate = useNavigate();
  const { role, roles, permissions, loading } = useAuth();

  const allowedByWorkOS = useMemo(
    () => isAdminRole(role, roles, permissions),
    [permissions, role, roles],
  );

  const adminViewer = useQuery({
    ...convexQuery(api.admin.viewer, {}),
    enabled: !loading && allowedByWorkOS,
    retry: false,
  });

  useEffect(() => {
    if (loading || allowedByWorkOS) {
      return;
    }

    void navigate({ to: "/dashboard", replace: true });
  }, [allowedByWorkOS, loading, navigate]);

  useEffect(() => {
    if (!adminViewer.error) {
      return;
    }

    toast.error("Your account is signed in, but it is not mapped to an admin profile yet.");
    void navigate({ to: "/dashboard", replace: true });
  }, [adminViewer.error, navigate]);

  if (loading || (!allowedByWorkOS && !adminViewer.error)) {
    return <Loader />;
  }

  if (adminViewer.isLoading || !adminViewer.data) {
    return <Loader />;
  }

  if (adminViewer.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-950">
            Admin access unavailable
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            We could not confirm your admin access for this workspace.
          </p>
          <Button
            className="mt-4"
            onClick={() => void navigate({ to: "/dashboard", replace: true })}
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      admin={{
        first_name: adminViewer.data.first_name,
        last_name: adminViewer.data.last_name,
        email: adminViewer.data.email,
        role: adminViewer.data.role,
      }}
    >
      <Outlet />
    </AdminShell>
  );
}
