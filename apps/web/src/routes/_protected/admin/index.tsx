import { api } from "@avm-daily/backend/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@avm-daily/ui/components/card";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AdminOverviewCards } from "@/components/admin-overview-cards";
import Loader from "@/components/loader";
import { formatAdminDateTime } from "@/lib/admin-formatters";

export const Route = createFileRoute("/_protected/admin/")({
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const summaryQuery = useQuery({
    ...convexQuery(api.admin.getOperationsSummary, {}),
    retry: false,
  });

  if (summaryQuery.isLoading || !summaryQuery.data) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Admin Overview
        </p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">
              Ops queues, minus the guesswork.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              This console keeps the live operational load in one place so we can
              move through withdrawals, KYC, bank verification, and reconciliation
              without jumping across tools.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Latest reconciliation closeout: {formatAdminDateTime(summaryQuery.data.reconciliation.latest_run?.completed_at)}
          </div>
        </div>
      </section>

      <AdminOverviewCards summary={summaryQuery.data} />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Operational Priorities</CardTitle>
            <CardDescription>
              Where the team should spend attention next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-700">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-medium text-zinc-950">Withdrawals</p>
              <p className="mt-1 text-zinc-600">
                {summaryQuery.data.withdrawals.pending} pending and {" "}
                {summaryQuery.data.withdrawals.approved} approved withdrawals are
                waiting on review or settlement.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-medium text-zinc-950">Identity checks</p>
              <p className="mt-1 text-zinc-600">
                {summaryQuery.data.kyc.pending_users} users are still in the KYC
                queue, and {summaryQuery.data.bankVerification.pending_accounts}{" "}
                bank accounts are pending verification.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-medium text-zinc-950">Ledger health</p>
              <p className="mt-1 text-zinc-600">
                There are {summaryQuery.data.reconciliation.open_issue_count} open
                reconciliation issues right now.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Jump Back In</CardTitle>
            <CardDescription>
              Quick links for the queues that usually need the fastest response.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <QuickLink
              to="/admin/alerts"
              title="Alerts inbox"
              description="Track queue breaches, reconciliation failures, and live ops issues."
            />
            <QuickLink
              to="/admin/withdrawals"
              title="Withdrawal review"
              description="Approve, reject, process, and manage user holds."
            />
            <QuickLink
              to="/admin/kyc"
              title="KYC review"
              description="Review pending identity documents and override provider results."
            />
            <QuickLink
              to="/admin/bank-verification"
              title="Bank verification"
              description="Inspect submitted account documents and complete verification."
            />
            <QuickLink
              to="/admin/reconciliation"
              title="Reconciliation"
              description="Track the last run and investigate open ledger mismatches."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function QuickLink({
  to,
  title,
  description,
}: {
  to:
    | "/admin/alerts"
    | "/admin/withdrawals"
    | "/admin/kyc"
    | "/admin/bank-verification"
    | "/admin/reconciliation";
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-300 hover:bg-white"
    >
      <p className="font-medium text-zinc-950">{title}</p>
      <p className="mt-1 text-zinc-600">{description}</p>
    </Link>
  );
}
