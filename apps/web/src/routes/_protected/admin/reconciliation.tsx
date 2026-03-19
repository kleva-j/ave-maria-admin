import { api } from "@avm-daily/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@avm-daily/ui/components/badge";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

import {
  formatAdminCurrencyFromKobo,
  formatAdminDateTime,
} from "@/lib/admin-formatters";

import Loader from "@/components/loader";

export const Route = createFileRoute("/_protected/admin/reconciliation")({
  component: AdminReconciliationPage,
});

function AdminReconciliationPage() {
  const runsQuery = useQuery({
    ...convexQuery(api.transactions.listReconciliationRuns, { limit: 10 }),
    retry: false,
  });
  const issuesQuery = useQuery({
    ...convexQuery(api.transactions.listOpenReconciliationIssues, {
      limit: 50,
    }),
    retry: false,
  });

  if (
    runsQuery.isLoading ||
    issuesQuery.isLoading ||
    !runsQuery.data ||
    !issuesQuery.data
  ) {
    return <Loader />;
  }

  const latestRun = runsQuery.data[0] ?? null;
  const issuesByType = Object.entries(
    issuesQuery.data.reduce<Record<string, typeof issuesQuery.data>>(
      (groups, issue) => {
        const key = issue.issue_type;
        groups[key] = [...(groups[key] ?? []), issue];
        return groups;
      },
      {},
    ),
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Latest run"
          value={latestRun?.status ?? "no run"}
          detail={`Completed ${formatAdminDateTime(latestRun?.completed_at)}`}
        />
        <SummaryCard
          title="Open issues"
          value={String(issuesQuery.data.length)}
          detail="Still waiting for system-level follow-up"
        />
        <SummaryCard
          title="Users checked"
          value={String(latestRun?.user_count ?? 0)}
          detail="Projected against cached balances"
        />
        <SummaryCard
          title="Plans checked"
          value={String(latestRun?.plan_count ?? 0)}
          detail="Active plan projections reviewed"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Recent reconciliation runs</CardTitle>
            <CardDescription>
              The newest run appears first. This page is read-only in v1 so we
              keep the focus on diagnosis, not manual overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runsQuery.data.map((run) => (
              <div
                key={run._id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-950">
                      Run {String(run._id).slice(-6)}
                    </p>
                    <p className="mt-1 text-zinc-600">
                      Started {formatAdminDateTime(run.started_at)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      run.status === "completed"
                        ? "secondary"
                        : run.status === "failed"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <InfoStat label="Issues" value={String(run.issue_count)} />
                  <InfoStat label="Users" value={String(run.user_count)} />
                  <InfoStat label="Plans" value={String(run.plan_count)} />
                </div>
              </div>
            ))}
            {runsQuery.data.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                No reconciliation runs have been recorded yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Open issues</CardTitle>
            <CardDescription>
              Grouped by issue type so ops and engineering can quickly see where
              the ledger is drifting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {issuesByType.map(([issueType, issues]) => (
              <div
                key={issueType}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-950">
                    {issueType}
                  </p>
                  <Badge variant="outline">{issues.length}</Badge>
                </div>
                <div className="mt-3 space-y-3">
                  {issues.map((issue) => (
                    <div
                      key={issue._id}
                      className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {issue.reference ? (
                            <Badge variant="outline">{issue.reference}</Badge>
                          ) : null}
                          {issue.transaction_id ? (
                            <Badge variant="outline">
                              txn {String(issue.transaction_id).slice(-6)}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-xs text-zinc-500">
                          {formatAdminDateTime(issue.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <InfoStat
                          label="Expected"
                          value={
                            issue.expected_amount_kobo !== undefined
                              ? formatAdminCurrencyFromKobo(
                                  issue.expected_amount_kobo,
                                )
                              : "—"
                          }
                        />
                        <InfoStat
                          label="Actual"
                          value={
                            issue.actual_amount_kobo !== undefined
                              ? formatAdminCurrencyFromKobo(
                                  issue.actual_amount_kobo,
                                )
                              : "—"
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {issuesByType.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                No open reconciliation issues right now.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
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

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-950">{value}</p>
    </div>
  );
}
