import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@avm-daily/ui/components/card";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/todos")({ component: TodosRoute });

function TodosRoute() {
  return (
    <div className="mx-auto flex w-full max-w-2xl px-4 py-12">
      <Card className="w-full rounded-3xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle>Todo Demo Retired</CardTitle>
          <CardDescription>
            The old Convex todo example was removed while we shifted the backend
            toward savings, KYC, withdrawals, and admin operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-600">
          <p>
            If you still want a sandbox feature here, we can replace this route
            with a transaction explorer or another finance-safe demo.
          </p>
          <Link to="/dashboard" className="font-medium text-zinc-950 underline underline-offset-4">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
