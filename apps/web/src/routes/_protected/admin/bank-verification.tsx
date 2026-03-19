import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";

import { Field, FieldError, FieldLabel } from "@avm-daily/ui/components/field";
import { normalizeConvexErrorMessage } from "@/lib/convex-errors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@avm-daily/ui/components/button";
import { toast } from "@avm-daily/ui/components/sonner";
import { Input } from "@avm-daily/ui/components/input";
import { Badge } from "@avm-daily/ui/components/badge";
import { useConvex, useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader } from "@/components/loader";

import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

import {
  formatAdminDateTime,
  formatFullName,
  formatBytes,
} from "@/lib/admin-formatters";

const VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;

export const Route = createFileRoute("/_protected/admin/bank-verification")({
  component: AdminBankVerificationPage,
});

function AdminBankVerificationPage() {
  const convex = useConvex();
  const queryClient = useQueryClient();
  const [status, setStatus] =
    useState<(typeof VERIFICATION_STATUSES)[number]>("pending");
  const [cursor, setCursor] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<any>>([]);
  const [selectedAccountId, setSelectedAccountId] =
    useState<Id<"user_bank_accounts"> | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | null
  >(null);

  const queueQueryOptions = convexQuery(
    api.verificationQueue.listPendingVerifications,
    {
      cursor,
      status,
    },
  );
  const queueQuery = useQuery({ ...queueQueryOptions, retry: false });

  useEffect(() => {
    if (!queueQuery.data) return;

    setAccounts((current) => {
      if (cursor === null) {
        return queueQuery.data.accounts;
      }

      const seen = new Set(current.map((account) => String(account._id)));
      const appended = queueQuery.data.accounts.filter(
        (account) => !seen.has(String(account._id)),
      );
      return [...current, ...appended];
    });
  }, [cursor, queueQuery.data]);

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAccountId(null);
      return;
    }

    const stillExists = accounts.some(
      (account) => account._id === selectedAccountId,
    );
    if (!selectedAccountId || !stillExists) {
      setSelectedAccountId(accounts[0]._id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account._id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const detailsQuery = useQuery({
    ...convexQuery(api.verificationQueue.getVerificationDetails, {
      accountId: selectedAccountId ?? ("" as never),
    }),
    enabled: Boolean(selectedAccountId),
    retry: false,
  });

  const approveVerification = useMutation(
    api.verificationQueue.approveVerification,
  );
  const rejectVerification = useMutation(
    api.verificationQueue.rejectVerification,
  );

  const handleStatusChange = (
    nextStatus: (typeof VERIFICATION_STATUSES)[number],
  ) => {
    setStatus(nextStatus);
    setCursor(null);
    setAccounts([]);
    setSelectedAccountId(null);
  };

  const refreshQueue = async () => {
    setCursor(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queueQueryOptions.queryKey }),
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.admin.getOperationsSummary, {}).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: selectedAccountId
          ? convexQuery(api.verificationQueue.getVerificationDetails, {
              accountId: selectedAccountId,
            }).queryKey
          : [],
      }),
    ]);
  };

  const handleOpenDocument = async (
    documentId: Id<"bank_account_documents">,
  ) => {
    try {
      const url = await convex.query(api.bankAccountDocuments.getDocumentUrl, {
        documentId,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(
          error,
          "Unable to open bank verification document",
        ),
      );
    }
  };

  const handleApprove = async () => {
    if (!selectedAccountId) {
      return;
    }

    try {
      setPendingAction("approve");
      await approveVerification({ accountId: selectedAccountId });
      toast.success("Bank account verified.");
      await refreshQueue();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to approve verification"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async () => {
    if (!selectedAccountId) {
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error("Add a rejection reason before rejecting this account.");
      return;
    }

    try {
      setPendingAction("reject");
      await rejectVerification({
        accountId: selectedAccountId,
        reason: rejectionReason.trim(),
      });
      setRejectionReason("");
      toast.success("Bank verification rejected.");
      await refreshQueue();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to reject verification"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  if (queueQuery.isLoading && accounts.length === 0) {
    return <Loader />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section>
        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Bank Verification Queue</CardTitle>
            <CardDescription>
              Review account submissions, inspect their documents, and complete
              verification from one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-600">
                {accounts.length} accounts loaded.
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <span>Status</span>
                <select
                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
                  value={status}
                  onChange={(event) =>
                    handleStatusChange(
                      event.target
                        .value as (typeof VERIFICATION_STATUSES)[number],
                    )
                  }
                >
                  {VERIFICATION_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-3">
              {accounts.map((account) => {
                const selected = account._id === selectedAccountId;
                return (
                  <button
                    key={account._id}
                    type="button"
                    onClick={() => setSelectedAccountId(account._id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {formatFullName([
                            account.user.first_name,
                            account.user.last_name,
                          ])}
                        </p>
                        <p
                          className={`text-sm ${selected ? "text-zinc-300" : "text-zinc-500"}`}
                        >
                          {account.bank_name} • ****
                          {account.account_number_last4}
                        </p>
                      </div>
                      <Badge variant={selected ? "secondary" : "outline"}>
                        {account.verification_status}
                      </Badge>
                    </div>
                    <p
                      className={`mt-3 text-xs ${selected ? "text-zinc-300" : "text-zinc-500"}`}
                    >
                      Submitted{" "}
                      {formatAdminDateTime(
                        account.verification_submitted_at ?? account.created_at,
                      )}
                    </p>
                  </button>
                );
              })}

              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  No bank accounts match this filter right now.
                </div>
              ) : null}
            </div>

            {!queueQuery.data?.isDone ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={!queueQuery.data?.continueCursor}
                onClick={() =>
                  setCursor(queueQuery.data?.continueCursor ?? null)
                }
              >
                Load more accounts
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        {selectedAccount && detailsQuery.data ? (
          <Card className="rounded-3xl border-zinc-200 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {formatFullName([
                      detailsQuery.data.user.first_name,
                      detailsQuery.data.user.last_name,
                    ])}
                  </CardTitle>
                  <CardDescription>
                    {detailsQuery.data.account.bank_name} • ****
                    {detailsQuery.data.account.account_number_last4}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {detailsQuery.data.account.verification_status}
                  </Badge>
                  {detailsQuery.data.account.is_primary ? (
                    <Badge variant="secondary">primary account</Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoTile label="Phone" value={detailsQuery.data.user.phone} />
                <InfoTile
                  label="Email"
                  value={detailsQuery.data.user.email ?? "—"}
                />
                <InfoTile
                  label="Submitted"
                  value={formatAdminDateTime(
                    detailsQuery.data.account.verification_submitted_at ??
                      detailsQuery.data.account.created_at,
                  )}
                />
                <InfoTile
                  label="Verified"
                  value={formatAdminDateTime(
                    detailsQuery.data.account.verified_at,
                  )}
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-950">Documents</p>
                <div className="mt-3 space-y-3">
                  {detailsQuery.data.documents.map((document) => (
                    <DocumentCard
                      key={document._id}
                      title={document.document_type.replace(/_/g, " ")}
                      subtitle={`Uploaded ${formatAdminDateTime(document.uploaded_at)}`}
                      meta={`${formatBytes(document.file_size)} • ${document.status}`}
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDocument(document._id)}
                        >
                          Open document
                        </Button>
                      }
                    >
                      {document.comments.length > 0 ? (
                        <div className="mt-3 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            Comment thread
                          </p>
                          {document.comments.map((comment) => (
                            <div
                              key={comment._id}
                              className="rounded-xl bg-white p-3 text-sm"
                            >
                              <p className="font-medium text-zinc-950">
                                {formatFullName([
                                  comment.admin.first_name,
                                  comment.admin.last_name,
                                ])}
                              </p>
                              <p className="mt-1 text-zinc-600">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </DocumentCard>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewActionCard
                  title="Approve verification"
                  description="Mark the account as verified and approve all pending documents."
                  buttonLabel={
                    pendingAction === "approve"
                      ? "Approving..."
                      : "Approve account"
                  }
                  onClick={handleApprove}
                />
                <ReviewActionCard
                  title="Reject verification"
                  description="Reject the account and require the user to resubmit with fixes."
                  buttonLabel={
                    pendingAction === "reject"
                      ? "Rejecting..."
                      : "Reject account"
                  }
                  onClick={handleReject}
                  extra={
                    <Field>
                      <FieldLabel htmlFor="bankRejectReason">
                        Rejection reason
                      </FieldLabel>
                      <Input
                        id="bankRejectReason"
                        value={rejectionReason}
                        onChange={(event) =>
                          setRejectionReason(event.target.value)
                        }
                        placeholder="Explain what must be corrected"
                      />
                      {!rejectionReason.trim() ? (
                        <FieldError>
                          Required when rejecting a bank verification request.
                        </FieldError>
                      ) : null}
                    </Field>
                  }
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-950">
                  Event history
                </p>
                <div className="mt-3 space-y-3">
                  {detailsQuery.data.eventHistory.map((event) => (
                    <div
                      key={event._id}
                      className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline">{event.event_type}</Badge>
                        <span className="text-xs text-zinc-500">
                          {formatAdminDateTime(event.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {detailsQuery.data.eventHistory.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No events recorded yet.
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-zinc-200 shadow-sm">
            <CardContent className="p-10 text-center text-sm text-zinc-500">
              Pick a bank account from the queue to inspect its documents and
              review history.
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
  children,
}: {
  title: string;
  subtitle: string;
  meta: string;
  action: ReactNode;
  children?: ReactNode;
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
      {children}
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
