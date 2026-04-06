import { normalizeConvexErrorMessage } from "@/lib/convex-errors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { formatAdminDateTime } from "@/lib/admin-formatters";
import { Button } from "@avm-daily/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "@avm-daily/ui/components/sonner";
import { Badge } from "@avm-daily/ui/components/badge";
import { convexQuery } from "@convex-dev/react-query";
import { Loader } from "@/components/loader";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

const STATUS_OPTIONS = [
  { label: "Active", value: "active" as const },
  { label: "Resolved", value: "resolved" as const },
] as const;

const SEVERITY_OPTIONS = [
  { label: "All", value: "all" as const },
  { label: "Warning", value: "warning" as const },
  { label: "Critical", value: "critical" as const },
] as const;

const SCOPE_OPTIONS = [
  { label: "All", value: "all" as const },
  { label: "Withdrawals", value: "withdrawals" as const },
  { label: "KYC", value: "kyc" as const },
  { label: "Bank Verification", value: "bank_verification" as const },
  { label: "Reconciliation", value: "reconciliation" as const },
] as const;

export const Route = createFileRoute("/_protected/admin/alerts")({
  component: AdminAlertsPage,
});

function AdminAlertsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"active" | "resolved">("active");
  const [severity, setSeverity] = useState<"all" | "warning" | "critical">(
    "all",
  );
  const [scope, setScope] = useState<
    "all" | "withdrawals" | "kyc" | "bank_verification" | "reconciliation"
  >("all");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const inboxQueryOptions = useMemo(
    () =>
      convexQuery(api.adminAlerts.listMyInbox, {
        status,
        severity: severity === "all" ? undefined : severity,
        scope: scope === "all" ? undefined : scope,
      }),
    [scope, severity, status],
  );

  const inboxQuery = useQuery({ ...inboxQueryOptions, retry: false });
  const summaryQuery = useQuery({
    ...convexQuery(api.adminAlerts.getMyActiveSummary, {}),
    retry: false,
  });

  const markSeen = useMutation(api.adminAlerts.markSeen);
  const acknowledgeReceipt = useMutation(api.adminAlerts.acknowledgeReceipt);
  const resolveAlert = useMutation(api.adminAlerts.resolveAlert);

  const refreshAlerts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: inboxQueryOptions.queryKey }),
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.adminAlerts.getMyUnreadCount, {}).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.adminAlerts.getMyActiveSummary, {}).queryKey,
      }),
    ]);
  };

  const runAction = async (
    alertId: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    try {
      setPendingActionId(alertId);
      await action();
      toast.success(successMessage);
      await refreshAlerts();
    } catch (error) {
      toast.error(normalizeConvexErrorMessage(error, "Alert action failed"));
    } finally {
      setPendingActionId(null);
    }
  };

  if (inboxQuery.isLoading || !inboxQuery.data || !summaryQuery.data) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Active alerts"
          value={String(summaryQuery.data.activeCount)}
          detail="Current shared incidents in the admin inbox"
        />
        <SummaryCard
          title="Critical"
          value={String(summaryQuery.data.criticalCount)}
          detail="Need immediate follow-up"
        />
        <SummaryCard
          title="Warnings"
          value={String(summaryQuery.data.warningCount)}
          detail="Breaches that are aging but not yet critical"
        />
        <SummaryCard
          title="Unread"
          value={String(summaryQuery.data.unreadCount)}
          detail="Personal inbox items you have not seen yet"
        />
      </section>

      <Card className="rounded-3xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle>Admin Alerts</CardTitle>
          <CardDescription>
            Queue breaches, stale reconciliation signals, and failed system
            events land here with personal receipt state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <FilterSelect
              label="Status"
              value={status}
              onChange={(value) => setStatus(value as typeof status)}
              options={STATUS_OPTIONS}
            />
            <FilterSelect
              label="Severity"
              value={severity}
              onChange={(value) => setSeverity(value as typeof severity)}
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              label="Scope"
              value={scope}
              onChange={(value) => setScope(value as typeof scope)}
              options={SCOPE_OPTIONS}
            />
          </div>

          <div className="space-y-4">
            {inboxQuery.data.map((entry) => {
              const alertId = String(entry.alert._id);
              const busy = pendingActionId === alertId;

              return (
                <div
                  key={alertId}
                  className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-zinc-950">
                          {entry.alert.title}
                        </p>
                        <Badge
                          variant={
                            entry.alert.severity === "critical"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {entry.alert.severity}
                        </Badge>
                        <Badge variant="outline">{entry.alert.scope}</Badge>
                        <Badge variant="outline">
                          {entry.receipt.delivery_state}
                        </Badge>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                        {entry.alert.body}
                      </p>
                    </div>
                    <Badge variant="outline">{entry.alert.status}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <InfoTile
                      label="First opened"
                      value={formatAdminDateTime(entry.alert.first_opened_at)}
                    />
                    <InfoTile
                      label="Last triggered"
                      value={formatAdminDateTime(entry.alert.last_triggered_at)}
                    />
                    <InfoTile
                      label="Last notified"
                      value={formatAdminDateTime(
                        entry.receipt.last_notified_at,
                      )}
                    />
                    <InfoTile
                      label="Routing"
                      value={entry.alert.routing_roles.join(", ")}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {entry.receipt.delivery_state === "unread" ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            alertId,
                            async () =>
                              await markSeen({ alertId: entry.alert._id }),
                            "Alert marked as seen.",
                          )
                        }
                      >
                        Mark seen
                      </Button>
                    ) : null}
                    {entry.receipt.delivery_state !== "acknowledged" ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            alertId,
                            async () =>
                              await acknowledgeReceipt({
                                alertId: entry.alert._id,
                              }),
                            "Alert acknowledged.",
                          )
                        }
                      >
                        Acknowledge
                      </Button>
                    ) : null}
                    {entry.alert.status === "active" ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            alertId,
                            async () =>
                              await resolveAlert({ alertId: entry.alert._id }),
                            "Alert resolved.",
                          )
                        }
                      >
                        Resolve
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {inboxQuery.data.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-sm text-zinc-500">
                No alerts match the current filter.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
};

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="space-y-2 text-sm text-zinc-600">
      <span className="block font-medium text-zinc-950">{label}</span>
      <select
        className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  detail: string;
};

function SummaryCard({ title, value, detail }: SummaryCardProps) {
  return (
    <Card className="rounded-3xl border-zinc-200 shadow-sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-600">{detail}</p>
      </CardContent>
    </Card>
  );
}

type InfoTileProps = {
  label: string;
  value: string;
};

function InfoTile({ label, value }: InfoTileProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-zinc-900">{value}</p>
    </div>
  );
}
