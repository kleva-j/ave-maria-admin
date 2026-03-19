import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { Badge } from "@avm-daily/ui/components/badge";
import { Button } from "@avm-daily/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@avm-daily/ui/components/card";
import { Field, FieldError, FieldLabel } from "@avm-daily/ui/components/field";
import { Input } from "@avm-daily/ui/components/input";
import { toast } from "@avm-daily/ui/components/sonner";
import { useConvex, useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import Loader from "@/components/loader";
import {
  formatAdminDateTime,
  formatBytes,
  formatFullName,
} from "@/lib/admin-formatters";
import { normalizeConvexErrorMessage } from "@/lib/convex-errors";

export const Route = createFileRoute("/_protected/admin/kyc")({
  component: AdminKycPage,
});

function AdminKycPage() {
  const convex = useConvex();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  const pendingKycQueryOptions = convexQuery(api.kyc.adminListPendingKyc, {});
  const pendingKycQuery = useQuery({
    ...pendingKycQueryOptions,
    retry: false,
  });

  const selectedEntry = useMemo(() => {
    return pendingKycQuery.data?.find((entry) => entry.user_id === selectedUserId) ?? null;
  }, [pendingKycQuery.data, selectedUserId]);

  const reviewKyc = useMutation(api.kyc.adminReviewKyc);

  useEffect(() => {
    if (!pendingKycQuery.data?.length) {
      setSelectedUserId(null);
      return;
    }

    const stillExists = pendingKycQuery.data.some(
      (entry) => entry.user_id === selectedUserId,
    );

    if (!selectedUserId || !stillExists) {
      setSelectedUserId(pendingKycQuery.data[0].user_id);
    }
  }, [pendingKycQuery.data, selectedUserId]);

  const handleOpenDocument = async (documentId: Id<"kyc_documents">) => {
    try {
      const url = await convex.query(api.kycDocuments.getDocumentUrl, { documentId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to open KYC document"),
      );
    }
  };

  const applyOptimisticRemoval = (userId: Id<"users">) => {
    queryClient.setQueryData(
      pendingKycQueryOptions.queryKey,
      (current: typeof pendingKycQuery.data) =>
        current?.filter((entry) => entry.user_id !== userId) ?? [],
    );
  };

  const refreshKyc = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pendingKycQueryOptions.queryKey }),
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.admin.getOperationsSummary, {}).queryKey,
      }),
    ]);
  };

  const handleApprove = async () => {
    if (!selectedEntry) {
      return;
    }

    try {
      setPendingAction("approve");
      applyOptimisticRemoval(selectedEntry.user_id);
      await reviewKyc({ userId: selectedEntry.user_id, approved: true });
      toast.success("KYC approved.");
      await refreshKyc();
    } catch (error) {
      toast.error(normalizeConvexErrorMessage(error, "Unable to approve KYC"));
      await refreshKyc();
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async () => {
    if (!selectedEntry) {
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error("Add a rejection reason before rejecting KYC.");
      return;
    }

    try {
      setPendingAction("reject");
      applyOptimisticRemoval(selectedEntry.user_id);
      await reviewKyc({
        userId: selectedEntry.user_id,
        approved: false,
        reason: rejectionReason.trim(),
      });
      setRejectionReason("");
      toast.success("KYC rejected.");
      await refreshKyc();
    } catch (error) {
      toast.error(normalizeConvexErrorMessage(error, "Unable to reject KYC"));
      await refreshKyc();
    } finally {
      setPendingAction(null);
    }
  };

  if (pendingKycQuery.isLoading || !pendingKycQuery.data) {
    return <Loader />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section>
        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>KYC Queue</CardTitle>
            <CardDescription>
              Oldest pending identity reviews appear first so the team can clear
              the queue fairly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingKycQuery.data.map((entry) => {
              const selected = entry.user_id === selectedUserId;
              return (
                <button
                  key={entry.user_id}
                  type="button"
                  onClick={() => setSelectedUserId(entry.user_id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {formatFullName([entry.first_name, entry.last_name])}
                      </p>
                      <p className={`text-sm ${selected ? "text-zinc-300" : "text-zinc-500"}`}>
                        {entry.phone}
                        {entry.email ? ` • ${entry.email}` : ""}
                      </p>
                    </div>
                    <Badge variant={selected ? "secondary" : "outline"}>
                      {entry.pending_documents.length} docs
                    </Badge>
                  </div>
                  <p className={`mt-3 text-xs ${selected ? "text-zinc-300" : "text-zinc-500"}`}>
                    Oldest submission {formatAdminDateTime(entry.pending_documents[0]?.created_at)}
                  </p>
                </button>
              );
            })}

            {pendingKycQuery.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                No users are currently waiting for manual KYC review.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        {selectedEntry ? (
          <Card className="rounded-3xl border-zinc-200 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {formatFullName([
                      selectedEntry.first_name,
                      selectedEntry.last_name,
                    ])}
                  </CardTitle>
                  <CardDescription>
                    Review pending documents, then approve or reject the identity check.
                  </CardDescription>
                </div>
                <Badge variant="outline">{selectedEntry.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoTile label="Phone" value={selectedEntry.phone} />
                <InfoTile label="Email" value={selectedEntry.email ?? "—"} />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-950">Pending documents</p>
                <div className="mt-3 space-y-3">
                  {selectedEntry.pending_documents.map((document) => (
                    <DocumentCard
                      key={document.document_id}
                      title={document.document_type.replace(/_/g, " ")}
                      subtitle={`Uploaded ${formatAdminDateTime(document.uploaded_at ?? document.created_at)}`}
                      meta={formatBytes(document.file_size)}
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDocument(document.document_id)}
                        >
                          Open document
                        </Button>
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewActionCard
                  title="Approve KYC"
                  description="Set the user to active and mark all pending documents as approved."
                  buttonLabel={pendingAction === "approve" ? "Approving..." : "Approve KYC"}
                  onClick={handleApprove}
                />
                <ReviewActionCard
                  title="Reject KYC"
                  description="Reject the documents, close the account, and capture the reason."
                  buttonLabel={pendingAction === "reject" ? "Rejecting..." : "Reject KYC"}
                  onClick={handleReject}
                  extra={
                    <Field>
                      <FieldLabel htmlFor="kycRejectionReason">Rejection reason</FieldLabel>
                      <Input
                        id="kycRejectionReason"
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder="Tell the user why KYC was rejected"
                      />
                      {!rejectionReason.trim() ? (
                        <FieldError>Required when rejecting a KYC submission.</FieldError>
                      ) : null}
                    </Field>
                  }
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-zinc-200 shadow-sm">
            <CardContent className="p-10 text-center text-sm text-zinc-500">
              Pick a user from the KYC queue to review their pending documents.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-zinc-950">{value}</p>
    </div>
  );
}

function DocumentCard({
  title,
  subtitle,
  meta,
  action,
}: {
  title: string;
  subtitle: string;
  meta: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-950">{title}</p>
          <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
          <p className="mt-1 text-xs text-zinc-500">{meta}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function ReviewActionCard({
  title,
  description,
  buttonLabel,
  onClick,
  extra,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-950">{title}</p>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
      {extra ? <div className="mt-3">{extra}</div> : null}
      <Button className="mt-3 w-full" onClick={onClick}>
        {buttonLabel}
      </Button>
    </div>
  );
}
