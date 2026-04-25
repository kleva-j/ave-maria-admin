import type { Doc, Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { Field, FieldError, FieldLabel } from "@avm-daily/ui/components/field";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { Button } from "@avm-daily/ui/components/button";
import { toast } from "@avm-daily/ui/components/sonner";
import { Input } from "@avm-daily/ui/components/input";
import { Badge } from "@avm-daily/ui/components/badge";
import { useConvex, useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

import {
  formatAdminDateTime,
  formatAdminRole,
  formatFullName,
} from "@/lib/admin-formatters";
import { normalizeConvexErrorMessage } from "@/lib/convex-errors";

import Loader from "@/components/loader";

type AdminUserRecord = Doc<"admin_users">;

const ADMIN_ROLES = [
  "super_admin",
  "operations",
  "finance",
  "compliance",
  "support",
] as const;

const STATUS_FILTERS = ["active", "suspended", "closed", "pending_kyc"] as const;

type RoleFilter = (typeof ADMIN_ROLES)[number] | "all";
type StatusFilter = (typeof STATUS_FILTERS)[number] | "all";

export const Route = createFileRoute("/_protected/admin/team")({
  component: AdminTeamPage,
});

function AdminTeamPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const convex = useConvex();

  const viewerQuery = useQuery({
    ...convexQuery(api.admin.viewer, {}),
    retry: false,
  });

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<Id<"admin_users"> | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "invite" | "role" | "deactivate" | "reactivate" | null
  >(null);
  const [pendingRole, setPendingRole] =
    useState<(typeof ADMIN_ROLES)[number] | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "operations" as (typeof ADMIN_ROLES)[number],
  });

  const isSuperAdmin = viewerQuery.data?.role === "super_admin";

  // Redirect non-super_admins back to /admin.
  useEffect(() => {
    if (viewerQuery.isLoading) {
      return;
    }
    if (viewerQuery.data && !isSuperAdmin) {
      toast.error("Only super admins can manage the team.");
      void navigate({ to: "/admin", replace: true });
    }
  }, [isSuperAdmin, navigate, viewerQuery.data, viewerQuery.isLoading]);

  const listOptions = convexQuery(api.admin.listAdminUsers, {
    role: roleFilter === "all" ? undefined : roleFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search.trim() || undefined,
  });

  const listQuery = useQuery({
    ...listOptions,
    enabled: Boolean(isSuperAdmin),
    retry: false,
  });

  const selected: AdminUserRecord | null = useMemo(() => {
    if (!listQuery.data) return null;
    return listQuery.data.find((row) => row._id === selectedId) ?? null;
  }, [listQuery.data, selectedId]);

  useEffect(() => {
    if (!listQuery.data?.length) {
      setSelectedId(null);
      return;
    }
    const stillExists = listQuery.data.some((row) => row._id === selectedId);
    if (!selectedId || !stillExists) {
      setSelectedId(listQuery.data[0]._id);
    }
  }, [listQuery.data, selectedId]);

  useEffect(() => {
    setPendingRole(selected?.role ?? null);
  }, [selected?._id, selected?.role]);

  const updateRole = useMutation(api.admin.updateAdminUserRole);
  const deactivate = useMutation(api.admin.deactivateAdminUser);
  const reactivate = useMutation(api.admin.reactivateAdminUser);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
  };

  const handleInvite = async () => {
    const email = inviteForm.email.trim();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!inviteForm.first_name.trim() || !inviteForm.last_name.trim()) {
      toast.error("First and last name are required.");
      return;
    }

    try {
      setPendingAction("invite");
      await convex.action(api.admin.inviteAdminUser, {
        email,
        first_name: inviteForm.first_name.trim(),
        last_name: inviteForm.last_name.trim(),
        role: inviteForm.role,
      });
      toast.success(`Invite sent to ${email}.`);
      setShowInvite(false);
      setInviteForm({
        email: "",
        first_name: "",
        last_name: "",
        role: "operations",
      });
      await refresh();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to invite admin user"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleUpdateRole = async () => {
    if (!selected || !pendingRole) return;
    if (pendingRole === selected.role) return;

    if (
      !window.confirm(
        `Change role for ${selected.email} from ${formatAdminRole(selected.role)} to ${formatAdminRole(pendingRole)}?`,
      )
    ) {
      return;
    }

    try {
      setPendingAction("role");
      await updateRole({ id: selected._id, role: pendingRole });
      toast.success("Role updated.");
      await refresh();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to update role"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeactivate = async () => {
    if (!selected) return;

    if (
      !window.confirm(
        `Deactivate ${selected.email}? They will lose admin access immediately.`,
      )
    ) {
      return;
    }

    try {
      setPendingAction("deactivate");
      await deactivate({ id: selected._id });
      toast.success("Admin user deactivated.");
      await refresh();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to deactivate"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleReactivate = async () => {
    if (!selected) return;
    try {
      setPendingAction("reactivate");
      await reactivate({ id: selected._id });
      toast.success("Admin user reactivated.");
      await refresh();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to reactivate"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  if (viewerQuery.isLoading || !viewerQuery.data) {
    return <Loader />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Team
          </h1>
          <p className="text-sm text-zinc-600">
            Invite admins, change roles, and revoke access.
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>Invite admin</Button>
      </header>

      {showInvite ? (
        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Invite admin</CardTitle>
            <CardDescription>
              Sends a WorkOS invitation email and provisions a Convex admin
              record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="invite-first-name">First name</FieldLabel>
              <Input
                id="invite-first-name"
                value={inviteForm.first_name}
                onChange={(event) =>
                  setInviteForm((prev) => ({
                    ...prev,
                    first_name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-last-name">Last name</FieldLabel>
              <Input
                id="invite-last-name"
                value={inviteForm.last_name}
                onChange={(event) =>
                  setInviteForm((prev) => ({
                    ...prev,
                    last_name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <select
                id="invite-role"
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
                value={inviteForm.role}
                onChange={(event) =>
                  setInviteForm((prev) => ({
                    ...prev,
                    role: event.target.value as (typeof ADMIN_ROLES)[number],
                  }))
                }
              >
                {ADMIN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {formatAdminRole(role)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowInvite(false)}
                disabled={pendingAction === "invite"}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={pendingAction === "invite"}
              >
                {pendingAction === "invite" ? "Sending..." : "Send invite"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <Card className="rounded-3xl border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Admins</CardTitle>
              <CardDescription>
                {listQuery.data?.length ?? 0} admin
                {(listQuery.data?.length ?? 0) === 1 ? "" : "s"} match your
                filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm text-zinc-600">
                  <span>Role</span>
                  <select
                    className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
                    value={roleFilter}
                    onChange={(event) =>
                      setRoleFilter(event.target.value as RoleFilter)
                    }
                  >
                    <option value="all">All roles</option>
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {formatAdminRole(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-zinc-600">
                  <span>Status</span>
                  <select
                    className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                  >
                    <option value="all">All statuses</option>
                    {STATUS_FILTERS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <Field>
                  <FieldLabel htmlFor="team-search">Search</FieldLabel>
                  <Input
                    id="team-search"
                    placeholder="name or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </Field>
              </div>

              {listQuery.isLoading ? (
                <Loader />
              ) : (
                <div className="space-y-3">
                  {listQuery.data?.map((row) => {
                    const isSelected = row._id === selectedId;
                    const displayName = formatFullName([
                      row.first_name,
                      row.last_name,
                    ]);
                    const isDeactivated = row.deleted_at !== undefined;

                    return (
                      <button
                        type="button"
                        key={row._id}
                        onClick={() => setSelectedId(row._id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{displayName}</p>
                            <p
                              className={`text-sm ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}
                            >
                              {row.email}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={isSelected ? "secondary" : "outline"}>
                              {formatAdminRole(row.role)}
                            </Badge>
                            <Badge
                              variant={
                                isDeactivated
                                  ? "destructive"
                                  : row.status === "active"
                                    ? isSelected
                                      ? "outline"
                                      : "secondary"
                                    : "outline"
                              }
                            >
                              {isDeactivated ? "deactivated" : row.status}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {listQuery.data?.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                      No admin users match these filters.
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          {selected ? (
            <Card className="rounded-3xl border-zinc-200 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      {formatFullName([selected.first_name, selected.last_name])}
                    </CardTitle>
                    <CardDescription>{selected.email}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {formatAdminRole(selected.role)}
                    </Badge>
                    <Badge
                      variant={
                        selected.deleted_at !== undefined
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {selected.deleted_at !== undefined
                        ? "deactivated"
                        : selected.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoTile
                    label="WorkOS ID"
                    value={selected.workosId}
                  />
                  <InfoTile
                    label="Created"
                    value={formatAdminDateTime(selected.created_at)}
                  />
                  <InfoTile
                    label="Last login"
                    value={formatAdminDateTime(selected.last_login_at)}
                  />
                  <InfoTile
                    label="Deactivated"
                    value={formatAdminDateTime(selected.deleted_at)}
                  />
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-950">
                      Change role
                    </p>
                    <p className="text-sm text-zinc-600">
                      Affects access immediately on next session.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="role-select">Role</FieldLabel>
                    <select
                      id="role-select"
                      className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
                      value={pendingRole ?? selected.role}
                      onChange={(event) =>
                        setPendingRole(
                          event.target.value as (typeof ADMIN_ROLES)[number],
                        )
                      }
                      disabled={selected.deleted_at !== undefined}
                    >
                      {ADMIN_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {formatAdminRole(role)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    onClick={handleUpdateRole}
                    disabled={
                      pendingAction === "role" ||
                      pendingRole === selected.role ||
                      selected.deleted_at !== undefined
                    }
                  >
                    {pendingAction === "role" ? "Saving..." : "Save role"}
                  </Button>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-950">
                      Access
                    </p>
                    <p className="text-sm text-zinc-600">
                      Deactivation revokes Convex admin access. Revoke the
                      WorkOS user separately if needed.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.deleted_at === undefined ? (
                      <Button
                        variant="destructive"
                        onClick={handleDeactivate}
                        disabled={
                          pendingAction === "deactivate" ||
                          selected._id === viewerQuery.data._id
                        }
                      >
                        {pendingAction === "deactivate"
                          ? "Deactivating..."
                          : "Deactivate"}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleReactivate}
                        disabled={pendingAction === "reactivate"}
                      >
                        {pendingAction === "reactivate"
                          ? "Reactivating..."
                          : "Reactivate"}
                      </Button>
                    )}
                  </div>
                  {selected._id === viewerQuery.data._id ? (
                    <Field>
                      <FieldError>
                        You cannot deactivate or demote yourself.
                      </FieldError>
                    </Field>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border-zinc-200 shadow-sm">
              <CardContent className="p-10 text-center text-sm text-zinc-500">
                Pick an admin from the list to view details and actions.
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-zinc-950 break-all">
        {value}
      </p>
    </div>
  );
}
