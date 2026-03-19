import { Badge } from "@avm-daily/ui/components/badge";
import { Link } from "@tanstack/react-router";
import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

type AdminOverviewCardsProps = {
  summary: {
    withdrawals: {
      pending: number;
      approved: number;
      rejected: number;
      processed: number;
    };
    kyc: {
      pending_users: number;
    };
    bankVerification: {
      pending_accounts: number;
      oldest_submission_at?: number;
    };
    reconciliation: {
      latest_run: {
        _id: string;
        status: string;
        issue_count: number;
        started_at: number;
        completed_at?: number;
      } | null;
      open_issue_count: number;
    };
  };
};

function formatDateTime(timestamp?: number) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function AdminOverviewCards({ summary }: AdminOverviewCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-3xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardDescription>Withdrawal Queue</CardDescription>
          <CardTitle>{summary.withdrawals.pending}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Approved {summary.withdrawals.approved}</Badge>
            <Badge variant="outline">Rejected {summary.withdrawals.rejected}</Badge>
            <Badge variant="outline">Processed {summary.withdrawals.processed}</Badge>
          </div>
          <Link to="/admin/withdrawals" className="text-sm font-medium text-zinc-900 underline underline-offset-4">
            Open withdrawals
          </Link>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardDescription>Pending KYC</CardDescription>
          <CardTitle>{summary.kyc.pending_users}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/admin/kyc" className="text-sm font-medium text-zinc-900 underline underline-offset-4">
            Review KYC queue
          </Link>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardDescription>Bank Verification</CardDescription>
          <CardTitle>{summary.bankVerification.pending_accounts}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600">
          <p>Oldest submission: {formatDateTime(summary.bankVerification.oldest_submission_at)}</p>
          <Link
            to="/admin/bank-verification"
            className="text-sm font-medium text-zinc-900 underline underline-offset-4"
          >
            Open bank verification
          </Link>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardDescription>Reconciliation</CardDescription>
          <CardTitle>{summary.reconciliation.open_issue_count}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                summary.reconciliation.latest_run?.status === "completed"
                  ? "secondary"
                  : "destructive"
              }
            >
              {summary.reconciliation.latest_run?.status ?? "no run"}
            </Badge>
            <span>
              Latest issues: {summary.reconciliation.latest_run?.issue_count ?? 0}
            </span>
          </div>
          <p>
            Last run: {formatDateTime(summary.reconciliation.latest_run?.completed_at)}
          </p>
          <Link
            to="/admin/reconciliation"
            className="text-sm font-medium text-zinc-900 underline underline-offset-4"
          >
            Open reconciliation
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
