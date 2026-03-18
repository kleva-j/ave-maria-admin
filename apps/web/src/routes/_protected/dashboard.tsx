import type { Id } from "@avm-daily/backend/convex/_generated/dataModel";
import type { ChangeEvent } from "react";

import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useAction, useConvex, useMutation } from "convex/react";
import { api } from "@avm-daily/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@avm-daily/ui/components/button";
import { Label } from "@avm-daily/ui/components/label";
import { convexQuery } from "@convex-dev/react-query";
import { useMemo, useRef, useState } from "react";

import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

export const Route = createFileRoute("/_protected/dashboard")({
  component: RouteComponent,
});

const DOC_TYPES = [
  "government_id",
  "selfie_with_id",
  "proof_of_address",
  "bank_statement",
] as const;

type DocumentType = (typeof DOC_TYPES)[number];

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function inferMimeType(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return MIME_BY_EXTENSION[ext] ?? null;
}

function RouteComponent() {
  const {
    user,
    sessionId,
    organizationId,
    role,
    roles,
    permissions,
    loading,
  } = useAuth();
  const convex = useConvex();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(
    "government_id",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requirements = useSuspenseQuery(
    convexQuery(api.kycDocuments.getKycRequirements, {}),
  ).data;
  const documents = useSuspenseQuery(
    convexQuery(api.kycDocuments.listMyDocuments, {}),
  ).data;

  const getUploadUrl = useMutation(api.kycDocuments.getUploadUrl);
  const uploadDocument = useMutation(api.kycDocuments.uploadDocument);
  const deleteDocument = useMutation(api.kycDocuments.deleteDocument);
  const verifyIdentity = useAction(api.kyc.verifyIdentity);

  const pendingTypes = useMemo(() => {
    return new Set(
      documents
        .filter((doc) => doc.status === "pending")
        .map((doc) => doc.document_type),
    );
  }, [documents]);

  const missingRequired = useMemo(() => {
    return requirements.required.filter((docType) => !pendingTypes.has(docType));
  }, [requirements.required, pendingTypes]);

  const handleUpload = async (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    if (!selectedFile) {
      setError("Pick a file before uploading.");
      return;
    }

    const mimeType =
      selectedFile.type || inferMimeType(selectedFile.name) || "application/pdf";

    try {
      setIsUploading(true);
      const { uploadUrl } = await getUploadUrl({
        fileName: selectedFile.name,
        documentType,
        mimeType,
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Storage upload failed");
      }

      const uploadPayload = (await uploadResponse.json()) as {
        storageId?: string;
      };
      if (!uploadPayload.storageId) {
        throw new Error("Storage ID missing in upload response");
      }

      await uploadDocument({
        documentType,
        storageId: uploadPayload.storageId as Id<"_storage">,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType,
      });

      setFeedback("Document uploaded successfully.");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload document",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setFeedback(null);

    try {
      setIsVerifying(true);
      const result = await verifyIdentity({});
      setFeedback(
        result.approved
          ? "KYC verified successfully. Your account is now active."
          : `KYC rejected: ${result.reason}`,
      );
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Failed to run KYC verification",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async (documentId: Id<"kyc_documents">) => {
    setError(null);
    setFeedback(null);
    try {
      await deleteDocument({ documentId });
      setFeedback("Document deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete document",
      );
    }
  };

  const handleOpen = async (documentId: Id<"kyc_documents">) => {
    setError(null);
    try {
      const url = await convex.query(api.kycDocuments.getDocumentUrl, {
        documentId,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Failed to open document",
      );
    }
  };

  if (loading) {
    return <div className="p-6">Loading session...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-medium">User:</span>{" "}
            {user?.email ?? user?.id ?? "Unknown"}
          </div>
          <div>
            <span className="font-medium">Session ID:</span>{" "}
            {sessionId ?? "Unavailable"}
          </div>
          <div>
            <span className="font-medium">Organization:</span>{" "}
            {organizationId ?? "None"}
          </div>
          <div>
            <span className="font-medium">Role:</span> {role ?? "None"}
          </div>
          <div>
            <span className="font-medium">Roles:</span>{" "}
            {roles?.length ? roles.join(", ") : "None"}
          </div>
          <div>
            <span className="font-medium">Permissions:</span>{" "}
            {permissions?.length ? permissions.join(", ") : "None"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KYC Documents</CardTitle>
          <CardDescription>
            Upload required documents and trigger automated verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div>
              <span className="font-medium">Required:</span>{" "}
              {requirements.required.join(", ")}
            </div>
            <div>
              <span className="font-medium">Optional:</span>{" "}
              {requirements.optional.join(", ")}
            </div>
            <div>
              <span className="font-medium">Max size:</span>{" "}
              {Math.round(requirements.maxFileSize / 1024 / 1024)}MB
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleUpload}>
            <div className="space-y-2">
              <Label htmlFor="documentType">Document type</Label>
              <select
                id="documentType"
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value as DocumentType)
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {DOC_TYPES.map((docType) => (
                  <option key={docType} value={docType}>
                    {docType}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Document file</Label>
              <input
                id="file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
            <Button type="submit" disabled={!selectedFile || isUploading}>
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <Button onClick={handleVerify} disabled={isVerifying}>
              {isVerifying ? "Verifying..." : "Run Automated Verification"}
            </Button>
            {missingRequired.length > 0 && (
              <span className="text-sm text-muted-foreground">
                Missing required documents: {missingRequired.join(", ")}
              </span>
            )}
          </div>

          {feedback && (
            <p className="rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-800">
              {feedback}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <h3 className="font-medium">Uploaded documents</h3>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No KYC documents uploaded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li
                    key={doc._id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{doc.document_type}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {doc.status}
                        {doc.file_name ? ` | ${doc.file_name}` : ""}
                      </p>
                      {doc.rejection_reason && (
                        <p className="text-xs text-red-600">
                          Reason: {doc.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpen(doc._id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={doc.status === "approved"}
                        onClick={() => handleDelete(doc._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
