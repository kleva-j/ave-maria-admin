import { normalizeConvexErrorMessage } from "@/lib/convex-errors";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { formatAdminDateTime } from "@/lib/admin-formatters";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@avm-daily/ui/components/button";
import { toast } from "@avm-daily/ui/components/sonner";
import { Badge } from "@avm-daily/ui/components/badge";
import { useAction, useQuery } from "convex/react";
import { Loader } from "@/components/loader";
import { useState } from "react";
import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

export const Route = createFileRoute("/_protected/admin/crm-contact-edits")({
  component: CrmContactEditsPage,
});

function CrmContactEditsPage() {
  const rows = useQuery(api.twentyContactEdits.listPending, {});
  const review = useAction(api.twentyContactEdits.review);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (rows === undefined) return <Loader />;
  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle>CRM contact edit review</CardTitle>
          <CardDescription>
            Contact changes submitted in Twenty stay pending here. Applying a
            change updates the app profile and queues the corrected profile back
            to Twenty.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No contact edits are waiting for review.
            </p>
          ) : (
            rows.map((row) => {
              const id = String(row._id);
              const busy = busyId === id;
              return (
                <section
                  key={id}
                  className="rounded-2xl border border-zinc-200 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {row.current_fields.first_name}{" "}
                        {row.current_fields.last_name}
                      </p>
                      <p className="text-sm text-zinc-600">
                        Received {formatAdminDateTime(row.received_at)}
                      </p>
                    </div>
                    <Badge variant="secondary">Pending review</Badge>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(
                      ["first_name", "last_name", "email", "phone"] as const
                    ).map((field) => {
                      const proposed = row.proposed_fields[field];
                      if (proposed === undefined) return null;
                      return (
                        <div key={field} className="rounded-xl bg-zinc-50 p-3">
                          <dt className="text-xs uppercase text-zinc-500">
                            {field.replace("_", " ")}
                          </dt>
                          <dd className="mt-1 text-sm">
                            {row.current_fields[field] || "(empty)"}{" "}
                            <span className="text-zinc-400">→</span>{" "}
                            {proposed || "(empty)"}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        setBusyId(id);
                        try {
                          await review({
                            requestId: row._id,
                            decision: "reject",
                          });
                          toast.success("Edit rejected");
                        } catch (error) {
                          toast.error(
                            normalizeConvexErrorMessage(
                              error,
                              "Could not reject edit",
                            ),
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusyId(id);
                        try {
                          await review({
                            requestId: row._id,
                            decision: "apply",
                          });
                          toast.success("Edit applied and queued for CRM sync");
                        } catch (error) {
                          toast.error(
                            normalizeConvexErrorMessage(
                              error,
                              "Could not apply edit",
                            ),
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      Apply to app
                    </Button>
                  </div>
                </section>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
