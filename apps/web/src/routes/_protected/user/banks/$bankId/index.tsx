import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
import { Suspense } from "react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Button } from "@avm-daily/ui/components/button";
import { toast } from "@avm-daily/ui/components/sonner";
import { Badge } from "@avm-daily/ui/components/badge";
import { Icon } from "@avm-daily/ui/components/icon";

import { BankVerificationUploader } from "@/components/bank-verification-uploader";
import { BankVerificationBadge } from "@/components/bank-verification-badge";

/**
 * /user/banks/$bankId — bank detail: header + verification status + doc list
 * + uploader + submit-for-verification CTA.
 *
 * Design source (`BanksScreen` in `avm-screens-3.jsx`) doesn't cover a detail
 * page; composition mirrors the KYC dashboard's uploader pattern with
 * design tokens.
 */
export const Route = createFileRoute("/_protected/user/banks/$bankId/")({
  component: BankDetailPage,
  parseParams: (raw) => ({ bankId: raw.bankId as Id<"user_bank_accounts"> }),
});

function BankDetailPage() {
  const { bankId } = Route.useParams();

  return (
    <div className="screen-anim pb-10">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <Link
          to="/user/banks"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Back to banks"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Bank details
          </h2>
        </div>
      </header>

      <Suspense fallback={<BodySkeleton />}>
        <Body bankId={bankId} />
      </Suspense>
    </div>
  );
}

function Body({ bankId }: { bankId: Id<"user_bank_accounts"> }) {
  const banksQ = useSuspenseQuery(
    convexQuery(api.bankAccounts.listMineMasked, {}),
  );
  const bank = banksQ.data.find((b) => b._id === bankId);

  if (!bank) {
    return (
      <div className="mx-5 mt-4 rounded-[18px] border border-border bg-card p-6 text-center">
        <p className="text-sm font-semibold text-foreground">
          Account not found
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          It may have been removed. Head back to the list.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-5 mt-4 flex flex-col gap-5">
      <div className="rounded-[18px] border border-border bg-card p-5">
        <div className="mb-3.5 flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] bg-primary-dim">
            <Icon name="building" size={21} color="var(--primary)" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-bold text-foreground">
                {bank.bank_name}
              </span>
              {bank.is_primary && <Badge variant="default">Primary</Badge>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              •••• {bank.account_number_last4}
              {bank.account_name != null && ` · ${bank.account_name}`}
            </div>
          </div>
          <BankVerificationBadge status={bank.verification_status} />
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-40 w-full rounded-[18px]" />}>
        <VerificationSection
          accountId={bankId}
          status={bank.verification_status}
        />
      </Suspense>

      <BankVerificationUploader accountId={bankId} />

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-[18px]" />}>
        <DocumentsList accountId={bankId} />
      </Suspense>
    </div>
  );
}

function VerificationSection({
  accountId,
  status,
}: {
  accountId: Id<"user_bank_accounts">;
  status: string;
}) {
  const readinessQ = useSuspenseQuery(
    convexQuery(api.bankAccountDocuments.checkVerificationReadiness, {
      accountId,
    }),
  );
  const readiness = readinessQ.data;
  const submit = useMutation(api.bankAccounts.submitForVerification);

  const alreadyVerified = status === "verified";
  const rejected = status === "rejected";
  const pending = status === "pending";

  const handleSubmit = async () => {
    try {
      await submit({ account_id: accountId });
      toast.success("Submitted for verification");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not submit for verification",
      );
    }
  };

  if (alreadyVerified) {
    return (
      <section className="rounded-[18px] border border-success/40 bg-success-dim p-5">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-dim">
            <Icon
              name="check"
              size={16}
              color="var(--success)"
              strokeWidth={2.5}
            />
          </span>
          <div className="text-sm font-bold text-success">Verified</div>
        </div>
        <p className="text-xs text-muted-foreground">
          This account is verified and ready for withdrawals.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[18px] border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            rejected ? "bg-destructive-dim" : "bg-warning-dim"
          }`}
        >
          <Icon
            name={rejected ? "alert-circle" : "clock"}
            size={16}
            color={rejected ? "var(--destructive)" : "var(--warning)"}
          />
        </span>
        <div>
          <div className="text-sm font-bold text-foreground">
            {rejected
              ? "Verification rejected"
              : pending
                ? "Verification pending"
                : "Verification required"}
          </div>
          <div className="text-xs text-muted-foreground">
            {rejected
              ? "Re-upload a valid document and resubmit."
              : "Upload the required documents, then submit for review."}
          </div>
        </div>
      </div>
      <ul className="mb-4 flex flex-col gap-2">
        {[
          ...readiness.uploadedDocuments.map((d) => ({
            type: d,
            uploaded: true,
          })),
          ...readiness.missingRequired.map((d) => ({
            type: d,
            uploaded: false,
          })),
        ].map((r) => (
          <li
            key={`${r.type}-${r.uploaded ? "yes" : "no"}`}
            className="flex items-center gap-2.5 text-xs text-foreground"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                r.uploaded
                  ? "border-success bg-success-dim"
                  : "border-border bg-secondary"
              }`}
            >
              {r.uploaded && (
                <Icon
                  name="check"
                  size={11}
                  color="var(--success)"
                  strokeWidth={2.5}
                />
              )}
            </span>
            <span className="capitalize">{r.type.replace(/_/g, " ")}</span>
          </li>
        ))}
      </ul>
      <Button
        variant="primary"
        size="md"
        disabled={!readiness.isReady || pending}
        onClick={() => void handleSubmit()}
        className="w-full"
      >
        {pending ? "Awaiting review" : "Submit for verification"}
      </Button>
    </section>
  );
}

function DocumentsList({ accountId }: { accountId: Id<"user_bank_accounts"> }) {
  const docsQ = useSuspenseQuery(
    convexQuery(api.bankAccountDocuments.listDocuments, { accountId }),
  );
  const docs = docsQ.data;

  if (docs.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[18px] border border-border bg-card p-5">
      <h4 className="mb-3 text-[15px] font-bold text-foreground">
        Uploaded documents
      </h4>
      <ul className="flex flex-col gap-2">
        {docs.map((doc) => (
          <li
            key={doc._id}
            className="flex items-center gap-3 rounded-[12px] border border-border bg-secondary/40 px-3.5 py-3 text-xs"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-dim">
              <Icon name="file-text" size={16} color="var(--primary)" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold capitalize text-foreground">
                {doc.document_type.replace(/_/g, " ")}
              </div>
              <div className="truncate text-muted-foreground">
                {doc.file_name}
              </div>
            </div>
            <Badge
              variant={
                doc.status === "approved"
                  ? "success"
                  : doc.status === "rejected"
                    ? "destructive"
                    : "warning"
              }
            >
              {doc.status}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BodySkeleton() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-[18px]" />
      <Skeleton className="h-40 w-full rounded-[18px]" />
      <Skeleton className="h-32 w-full rounded-[18px]" />
    </div>
  );
}
