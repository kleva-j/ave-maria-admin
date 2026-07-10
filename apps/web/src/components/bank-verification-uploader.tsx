import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";

import { useRef, useState, type ChangeEvent } from "react";
import { useMutation } from "convex/react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { toast } from "@avm-daily/ui/components/sonner";
import { Icon } from "@avm-daily/ui/components/icon";
import { cn } from "@avm-daily/ui/lib/utils";

import { posthog } from "@/lib/posthog";

/**
 * Verification document upload for a single bank account. Extrapolated from
 * the design's KYC uploader (see `apps/web/src/routes/_protected/dashboard.tsx`)
 * with a bank-account-scoped call site. Camera capture defaults to the back
 * camera for document scans; selfie uploads switch to the front camera.
 *
 * Upload flow (Convex storage two-step):
 *   1. bankAccountDocuments.getUploadUrl → returns an opaque `uploadUrl`.
 *   2. POST the file to `uploadUrl` → the storage service echoes back a JSON
 *      body with the fresh `storageId` (the URL itself is single-use).
 *   3. bankAccountDocuments.uploadDocument registers `storageId` against the
 *      account so admins can review it.
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches server-side check.
const ACCEPTED_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;

const DOC_TYPES = [
  { value: "government_id", label: "Government ID" },
  { value: "proof_of_address", label: "Proof of address" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "selfie_with_id", label: "Selfie with ID" },
] as const;

type DocType = (typeof DOC_TYPES)[number]["value"];

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function inferMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/pdf";
}

export function BankVerificationUploader({
  accountId,
}: {
  accountId: Id<"user_bank_accounts">;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocType>("government_id");
  const [uploading, setUploading] = useState(false);

  const getUploadUrl = useMutation(api.bankAccountDocuments.getUploadUrl);
  const uploadDocument = useMutation(api.bankAccountDocuments.uploadDocument);

  const handlePick = () => fileInputRef.current?.click();

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const mimeType = file.type || inferMime(file.name);
    if (!ACCEPTED_MIME.includes(mimeType as (typeof ACCEPTED_MIME)[number])) {
      toast.error("Only JPG, PNG, or PDF files are accepted.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`,
      );
      return;
    }
    setUploading(true);
    try {
      const { uploadUrl } = await getUploadUrl({
        accountId,
        documentType: docType,
        fileName: file.name,
        mimeType,
      });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: file,
      });
      if (!res.ok) throw new Error("Storage upload failed");
      const payload = (await res.json()) as { storageId?: string };
      if (!payload.storageId) throw new Error("Storage ID missing");

      await uploadDocument({
        accountId,
        documentType: docType,
        storageId: payload.storageId as Id<"_storage">,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
      });
      posthog.capture("bank_verification_document_uploaded", {
        document_type: docType,
        file_size: file.size,
        mime_type: mimeType,
        account_id: accountId,
      });
      toast.success("Document uploaded for review");
    } catch (err) {
      posthog.captureException(err);
      toast.error(
        err instanceof Error ? err.message : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-[18px] border border-border bg-card p-5">
      <h4 className="mb-3 text-[15px] font-bold text-foreground">
        Upload verification document
      </h4>
      <div className="mb-4 flex flex-wrap gap-2">
        {DOC_TYPES.map((t) => {
          const selected = t.value === docType;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-pressed={selected}
              onClick={() => setDocType(t.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? "border-primary bg-primary-dim text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handlePick}
        disabled={uploading}
        className="flex w-full flex-col items-center gap-2.5 rounded-[14px] border-[2px] border-dashed border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-primary-dim px-4 py-6 text-primary transition-opacity disabled:opacity-60"
      >
        <Icon name="upload" size={24} color="var(--primary)" />
        <span className="text-sm font-semibold">
          {uploading ? "Uploading…" : "Tap to upload document"}
        </span>
        <span className="text-xs text-muted-foreground">
          JPG, PNG or PDF · Max 5MB
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        capture={docType === "selfie_with_id" ? "user" : "environment"}
        onChange={(e) => void handleFile(e)}
        className="sr-only"
      />
    </section>
  );
}
