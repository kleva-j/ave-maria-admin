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
  formatFullName,
} from "@/lib/admin-formatters";

import Loader from "@/components/loader";

const WITHDRAWAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "processed",
] as const;

export const Route = createFileRoute("/_protected/admin/withdrawals")({
  component: AdminWithdrawalsPage,
});

function AdminWithdrawalsPage() {
  const convex = useConvex();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<
    (typeof WITHDRAWAL_STATUSES)[number] | "all"
  >("pending");
  const [selectedWithdrawalId, setSelectedWithdrawalId] =
    useState<Id<"withdrawals"> | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | "process" | "place_hold" | "release_hold" | null
  >(null);

  const withdrawalsQueryOptions = convexQuery(api.withdrawals.listForReview, {
    status: status === "all" ? undefined : status,
  });
  const withdrawalsQuery = useQuery({
    ...withdrawalsQueryOptions,
    retry: false,
  });

  const selectedWithdrawal = useMemo(() => {
    return (
      withdrawalsQuery.data?.find(
        (row) => row.withdrawal._id === selectedWithdrawalId,
      ) ?? null
    );
  }, [selectedWithdrawalId, withdrawalsQuery.data]);

  const riskEventsQuery = useQuery({
    ...convexQuery(api.risk.listEventsForAdmin, {
      userId: selectedWithdrawal?.user._id,
      limit: 8,
    }),
    enabled: Boolean(selectedWithdrawal?.user._id),
    retry: false,
  });

  const approveWithdrawal = useMutation(api.withdrawals.approve);
  const rejectWithdrawal = useMutation(api.withdrawals.reject);
  const processWithdrawal = useMutation(api.withdrawals.process);
  const placeUserHold = useMutation(api.risk.placeUserHold);
  const releaseUserHold = useMutation(api.risk.releaseUserHold);

  useEffect(() => {
    if (!withdrawalsQuery.data?.length) {
      setSelectedWithdrawalId(null);
      return;
    }

    const stillExists = withdrawalsQuery.data.some(
      (row) => row.withdrawal._id === selectedWithdrawalId,
    );

    if (!selectedWithdrawalId || !stillExists) {
      setSelectedWithdrawalId(withdrawalsQuery.data[0].withdrawal._id);
    }
  }, [selectedWithdrawalId, withdrawalsQuery.data]);

  const refreshQueues = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: withdrawalsQueryOptions.queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.admin.getOperationsSummary, {}).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.risk.listEventsForAdmin, {
          userId: selectedWithdrawal?.user._id,
          limit: 8,
        }).queryKey,
      }),
    ]);
  };

  const handleOpenBankDocument = async () => {
    if (!selectedWithdrawal) {
      return;
    }

    const bankAccount =
      selectedWithdrawal.withdrawal.bank_account &&
      "account_id" in selectedWithdrawal.withdrawal.bank_account
        ? selectedWithdrawal.withdrawal.bank_account
        : undefined;
    const bankAccountId = bankAccount?.account_id;
    if (!bankAccountId) {
      return;
    }

    try {
      const details = await convex.query(
        api.verificationQueue.getVerificationDetails,
        { accountId: bankAccountId },
      );

      if (!details.documents[0]) {
        toast.info(
          "No verification document is attached to this bank account yet.",
        );
        return;
      }

      const url = await convex.query(api.bankAccountDocuments.getDocumentUrl, {
        documentId: details.documents[0]._id,
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
    if (!selectedWithdrawal) {
      return;
    }

    try {
      setPendingAction("approve");
      await approveWithdrawal({
        withdrawal_id: selectedWithdrawal.withdrawal._id,
      });
      toast.success("Withdrawal approved.");
      await refreshQueues();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to approve withdrawal"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async () => {
    if (!selectedWithdrawal) {
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error("Add a rejection reason before rejecting this withdrawal.");
      return;
    }

    try {
      setPendingAction("reject");
      await rejectWithdrawal({
        withdrawal_id: selectedWithdrawal.withdrawal._id,
        reason: rejectionReason.trim(),
      });
      setRejectionReason("");
      toast.success("Withdrawal rejected and funds restored.");
      await refreshQueues();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to reject withdrawal"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleProcess = async () => {
    if (!selectedWithdrawal) {
      return;
    }

    try {
      setPendingAction("process");
      await processWithdrawal({
        withdrawal_id: selectedWithdrawal.withdrawal._id,
      });
      toast.success("Withdrawal marked as processed.");
      await refreshQueues();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to process withdrawal"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handlePlaceHold = async () => {
    if (!selectedWithdrawal) {
      return;
    }

    if (!holdReason.trim()) {
      toast.error("Add a hold reason before placing a withdrawal hold.");
      return;
    }

    try {
      setPendingAction("place_hold");
      await placeUserHold({
        userId: selectedWithdrawal.user._id,
        reason: holdReason.trim(),
      });
      setHoldReason("");
      toast.success("Withdrawal hold placed.");
      await refreshQueues();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to place withdrawal hold"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleReleaseHold = async () => {
    if (!selectedWithdrawal) {
      return;
    }

    try {
      setPendingAction("release_hold");
      await releaseUserHold({ userId: selectedWithdrawal.user._id });
      toast.success("Withdrawal hold released.");
      await refreshQueues();
    } catch (error) {
      toast.error(
        normalizeConvexErrorMessage(error, "Unable to release withdrawal hold"),
      );
    } finally {
      setPendingAction(null);
    }
  };

  if (withdrawalsQuery.isLoading || !withdrawalsQuery.data) {
    return <Loader />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-4">
        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Withdrawal Queue</CardTitle>
            <CardDescription>
              Review pending and in-flight withdrawals with server-side action
              gating and risk context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-600">
                {withdrawalsQuery.data.length} withdrawals in this view.
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <span>Status</span>
                <select
                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as typeof status)
                  }
                >
                  <option value="all">All</option>
                  {WITHDRAWAL_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-3">
              {withdrawalsQuery.data.map((row) => {
                const selected = row.withdrawal._id === selectedWithdrawalId;
                const displayName = formatFullName([
                  row.user.first_name,
                  row.user.last_name,
                ]);

                return (
                  <button
                    type="button"
                    key={row.withdrawal._id}
                    onClick={() => setSelectedWithdrawalId(row.withdrawal._id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{displayName}</p>
                        <p
                          className={`text-sm ${selected ? "text-zinc-300" : "text-zinc-500"}`}
                        >
                          {row.user.phone}
                          {row.user.email ? ` • ${row.user.email}` : ""}
                        </p>
                      </div>
                      <Badge variant={selected ? "secondary" : "outline"}>
                        {row.withdrawal.status}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={selected ? "outline" : "secondary"}>
                        {row.withdrawal.method.replace("_", " ")}
                      </Badge>
                      {row.risk.has_active_hold ? (
                        <Badge variant="destructive">hold active</Badge>
                      ) : null}
                      <span
                        className={selected ? "text-zinc-300" : "text-zinc-600"}
                      >
                        {formatAdminCurrencyFromKobo(
                          row.withdrawal.requested_amount_kobo,
                        )}
                      </span>
                      <span
                        className={selected ? "text-zinc-300" : "text-zinc-600"}
                      >
                        {formatAdminDateTime(row.withdrawal.requested_at)}
                      </span>
                    </div>
                  </button>
                );
              })}

              {withdrawalsQuery.data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  No withdrawals match this filter right now.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        {selectedWithdrawal ? (
          <Card className="rounded-3xl border-zinc-200 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {formatFullName([
                      selectedWithdrawal.user.first_name,
                      selectedWithdrawal.user.last_name,
                    ])}
                  </CardTitle>
                  <CardDescription>
                    Ref {selectedWithdrawal.withdrawal.transaction_reference}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {selectedWithdrawal.user.status}
                  </Badge>
                  <Badge variant="secondary">
                    {selectedWithdrawal.withdrawal.method.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">
                    {selectedWithdrawal.withdrawal.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoTile
                  label="Requested amount"
                  value={formatAdminCurrencyFromKobo(
                    selectedWithdrawal.withdrawal.requested_amount_kobo,
                  )}
                />
                <InfoTile
                  label="Requested at"
                  value={formatAdminDateTime(
                    selectedWithdrawal.withdrawal.requested_at,
                  )}
                />
                <InfoTile label="Phone" value={selectedWithdrawal.user.phone} />
                <InfoTile
                  label="Email"
                  value={selectedWithdrawal.user.email ?? "—"}
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-950">
                  Payout details
                </p>
                {selectedWithdrawal.withdrawal.method === "bank_transfer" ? (
                  <div className="mt-2 space-y-1 text-sm text-zinc-600">
                    <p>
                      {selectedWithdrawal.withdrawal.bank_account?.bank_name ??
                        "Unknown bank"}
                    </p>
                    <p>
                      {selectedWithdrawal.withdrawal.bank_account
                        ?.account_name ?? "Unnamed account"}
                    </p>
                    <p>
                      ****
                      {selectedWithdrawal.withdrawal.bank_account
                        ?.account_number_last4 ?? "----"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleOpenBankDocument}
                    >
                      Open verification document
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1 text-sm text-zinc-600">
                    <p>
                      {
                        selectedWithdrawal.withdrawal.cash_details
                          ?.recipient_name
                      }
                    </p>
                    <p>
                      {
                        selectedWithdrawal.withdrawal.cash_details
                          ?.recipient_phone
                      }
                    </p>
                    <p>
                      {selectedWithdrawal.withdrawal.cash_details
                        ?.pickup_note ?? "No pickup note"}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-950">
                      Risk and holds
                    </p>
                    <p className="text-sm text-zinc-600">
                      Active holds block approval and processing until they are
                      released.
                    </p>
                  </div>
                  {selectedWithdrawal.risk.has_active_hold ? (
                    <Badge variant="destructive">Withdrawal hold active</Badge>
                  ) : (
                    <Badge variant="secondary">No active hold</Badge>
                  )}
                </div>

                {selectedWithdrawal.risk.block_reason ? (
                  <Field className="mt-3">
                    <FieldError>
                      {selectedWithdrawal.risk.block_reason}
                    </FieldError>
                  </Field>
                ) : null}

                <div className="mt-4 space-y-3">
                  <Field>
                    <FieldLabel htmlFor="holdReason">Hold reason</FieldLabel>
                    <Input
                      id="holdReason"
                      value={holdReason}
                      onChange={(event) => setHoldReason(event.target.value)}
                      placeholder="Explain why withdrawals should be blocked"
                      disabled={selectedWithdrawal.risk.has_active_hold}
                    />
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      disabled={
                        selectedWithdrawal.risk.has_active_hold ||
                        pendingAction === "place_hold"
                      }
                      onClick={handlePlaceHold}
                    >
                      {pendingAction === "place_hold"
                        ? "Placing hold..."
                        : "Place hold"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        !selectedWithdrawal.risk.has_active_hold ||
                        pendingAction === "release_hold"
                      }
                      onClick={handleReleaseHold}
                    >
                      {pendingAction === "release_hold"
                        ? "Releasing..."
                        : "Release hold"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <ActionCard
                  title="Approve"
                  description="Move a pending request into the approved state."
                  disabled={!selectedWithdrawal.capabilities.approve.allowed}
                  reason={selectedWithdrawal.capabilities.approve.reason}
                  buttonLabel={
                    pendingAction === "approve"
                      ? "Approving..."
                      : "Approve withdrawal"
                  }
                  onClick={handleApprove}
                />
                <ActionCard
                  title="Reject"
                  description="Reject the request and create the matching reversal entry."
                  disabled={!selectedWithdrawal.capabilities.reject.allowed}
                  reason={selectedWithdrawal.capabilities.reject.reason}
                  buttonLabel={
                    pendingAction === "reject"
                      ? "Rejecting..."
                      : "Reject withdrawal"
                  }
                  onClick={handleReject}
                  extra={
                    <Field>
                      <FieldLabel htmlFor="rejectionReason">
                        Rejection reason
                      </FieldLabel>
                      <Input
                        id="rejectionReason"
                        value={rejectionReason}
                        onChange={(event) =>
                          setRejectionReason(event.target.value)
                        }
                        placeholder="Share the reason for this rejection"
                      />
                    </Field>
                  }
                />
                <ActionCard
                  title="Process"
                  description="Mark an approved withdrawal as fully processed."
                  disabled={!selectedWithdrawal.capabilities.process.allowed}
                  reason={selectedWithdrawal.capabilities.process.reason}
                  buttonLabel={
                    pendingAction === "process"
                      ? "Processing..."
                      : "Mark processed"
                  }
                  onClick={handleProcess}
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-950">
                  Recent risk events
                </p>
                <div className="mt-3 space-y-3">
                  {riskEventsQuery.data?.length ? (
                    riskEventsQuery.data.map((event) => (
                      <div
                        key={event._id}
                        className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{event.event_type}</Badge>
                            <Badge
                              variant={
                                event.severity === "critical"
                                  ? "destructive"
                                  : event.severity === "warning"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {event.severity}
                            </Badge>
                          </div>
                          <span className="text-xs text-zinc-500">
                            {formatAdminDateTime(event.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 text-zinc-700">{event.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No risk events have been recorded for this user yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-zinc-200 shadow-sm">
            <CardContent className="p-10 text-center text-sm text-zinc-500">
              Pick a withdrawal from the queue to review the payout details,
              risk state, and next actions.
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

function ActionCard({
  title,
  description,
  disabled,
  reason,
  buttonLabel,
  onClick,
  extra,
}: {
  title: string;
  description: string;
  disabled: boolean;
  reason?: string;
  buttonLabel: string;
  onClick: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-950">{title}</p>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
      {extra ? <div className="mt-3">{extra}</div> : null}
      <div className="mt-3 space-y-2">
        <Button className="w-full" disabled={disabled} onClick={onClick}>
          {buttonLabel}
        </Button>
        {reason ? (
          <Field>
            <FieldError>{reason}</FieldError>
          </Field>
        ) : null}
      </div>
    </div>
  );
}
