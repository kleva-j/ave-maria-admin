# KYC Document Management System

## Overview

The `kycDocuments.ts` module provides a complete document upload, storage, and retrieval system for Know Your Customer (KYC) verification. It integrates with Convex's file storage and implements secure access controls, validation, and audit logging.

**Primary Responsibilities**:

- Secure document upload workflow
- File type and size validation
- Document metadata management
- Access control enforcement
- Audit trail maintenance
- Document lifecycle management, including rejected-document replacement

---

## Architecture

```
┌─────────────────────┐
│   User Uploads      │
│   Document          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  getUploadUrl Mutation  │
│  ─────────────────────  │
│  • Validate file type   │
│  • Validate MIME type   │
│  • Generate pre-signed  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Direct Upload to       │
│  Convex Storage         │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  uploadDocument Mutation│
│  ─────────────────────  │
│  • Create DB record     │
│  • Link storage ID      │
│  • Log audit event      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Document Available     │
│  for Review             │
└─────────────────────────┘
```

---

## Document Types

### Required KYC Documents

These documents are mandatory for KYC verification:

```typescript
const REQUIRED_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.GOVERNMENT_ID, // National ID, Passport, Driver's License
  DOCUMENT_TYPES.SELFIE_WITH_ID, // Selfie holding the government ID
] as const;
```

### Optional KYC Documents

Additional documents for enhanced verification:

```typescript
const OPTIONAL_KYC_DOCUMENTS = [
  DOCUMENT_TYPES.PROOF_OF_ADDRESS, // Utility bill, bank statement
  DOCUMENT_TYPES.BANK_STATEMENT, // Financial institution statement
] as const;
```

---

## File Validation Rules

### Allowed File Types

```typescript
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"] as const;
```

### Allowed MIME Types

```typescript
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
```

### File Size Limit

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
```

---

## Upload Workflow

### Step 1: Request Upload URL

User requests a pre-signed upload URL:

```typescript
const { uploadUrl } = await ctx.runMutation(kycDocuments.getUploadUrl, {
  documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
  fileName: "passport.jpg",
  mimeType: "image/jpeg",
});
```

**Validation Performed**:

- File name has valid extension
- MIME type is allowed
- User is authenticated

**Returns**:

```typescript
{
  uploadUrl: string; // Pre-signed Convex storage URL
}
```

---

### Step 2: Upload File Directly

Client uploads file directly to Convex storage:

```typescript
// Client-side code
const response = await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    "Content-Type": mimeType,
  },
  body: fileBlob,
});

if (!response.ok) {
  throw new Error("Upload failed");
}

// Extract storage ID from URL or response
const storageId = extractStorageId(uploadUrl);
```

**Important**: This step happens client-side, not through Convex mutations. After rejection, a fresh upload of the same document type is allowed as long as there is no existing pending document of that type.

---

### Step 3: Confirm Upload

After successful upload, confirm and create database record:

```typescript
const document = await ctx.runMutation(kycDocuments.uploadDocument, {
  documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
  storageId: storageId,
  fileName: "passport.jpg",
  fileSize: file.size,
  mimeType: "image/jpeg",
});
```

**Validation Performed**:

- File size within limits
- No existing pending document of same type
- User is authenticated

**Returns**:

```typescript
{
  _id: Id<"kyc_documents">,
  document_type: "government_id",
  status: "pending",
  file_name: "passport.jpg",
  file_size: 2048576,
  mime_type: "image/jpeg",
  uploaded_at: 1234567890000,
  supersedes_document_id: Id<"kyc_documents"> | undefined,
  created_at: 1234567890000,
}
```

---

## Core Functions

### `validateFileName(fileName)`

Internal validation function for file extensions.

```typescript
function validateFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  const valid = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!valid) {
    throw new ConvexError(
      `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
    );
  }
}
```

**Error Example**:

```
"Invalid file type. Allowed: .jpg, .jpeg, .png, .pdf"
```

---

### `getUploadUrl(args)`

Generates pre-signed upload URL for direct-to-storage upload.

**Arguments**:

```typescript
{
  documentType: bankAccountDocumentType;
  fileName: v.string();
  mimeType: v.string();
}
```

**Validation**:

1. User authentication check
2. File name validation (extension)
3. MIME type validation

**Returns**: `{ uploadUrl: string }`

**Usage**:

```typescript
export const getUploadUrl = mutation({
  handler: async (ctx, args) => {
    await ensureAuthedUser(ctx);

    validateFileName(args.fileName);

    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError(
        `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
      );
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});
```

---

### `uploadDocument(args)`

Creates database record after successful upload.

**Arguments**:

```typescript
{
  documentType: bankAccountDocumentType;
  storageId: v.id("_storage");
  fileName: v.string();
  fileSize: v.number();
  mimeType: v.string();
}
```

**Validation**:

1. File size ≤ MAX_FILE_SIZE (5MB)
2. File name extension valid
3. MIME type allowed
4. No existing pending document of same type

**Side Effects**:

1. Inserts `kyc_documents` record
2. Links storage ID
3. Sets status to PENDING
4. Logs audit event

**Returns**: Document object with metadata

**Implementation**:

```typescript
export const uploadDocument = mutation({
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    // Validate file size
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new ConvexError(
        `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Validate file properties
    validateFileName(args.fileName);
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new ConvexError(
        `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
      );
    }

    // Check for duplicate pending document
    const existingPending = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id_and_status", (q) =>
        q.eq("user_id", user._id).eq("status", KYCStatus.PENDING)
      )
      .filter((q) => q.eq(q.field("document_type"), args.documentType))
      .first();

    if (existingPending) {
      throw new ConvexError(
        `A pending ${args.documentType} document already exists`
      );
    }

    // Create database record
    const now = Date.now();
    const documentId = await ctx.db.insert(TABLE_NAMES.KYC_DOCUMENTS, {
      user_id: user._id,
      document_type: args.documentType,
      storage_id: args.storageId,
      file_name: args.fileName,
      file_size: args.fileSize,
      mime_type: args.mimeType,
      uploaded_at: now,
      status: KYCStatus.PENDING,
      created_at: now,
    });

    const document = await ctx.db.get(documentId);
    if (!document) {
      throw new ConvexError("Failed to create KYC document");
    }

    // Log audit event
    await auditLog.log(ctx, {
      action: "kyc.document_uploaded",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.KYC_DOCUMENTS,
      resourceId: document._id,
      severity: "info",
      metadata: {
        document_type: args.documentType,
        file_name: args.fileName,
        file_size: args.fileSize,
        mime_type: args.mimeType,
      },
    });

    return {
      _id: document._id,
      document_type: document.document_type,
      status: document.status,
      file_name: document.file_name,
      file_size: document.file_size,
      mime_type: document.mime_type,
      uploaded_at: document.uploaded_at,
      created_at: document.created_at,
    };
  },
});
```

---

### `getDocumentUrl(args)`

Generates download URL for viewing documents.

**Arguments**:

```typescript
{
  documentId: v.id("kyc_documents");
}
```

**Authorization**:

- Admin users: Can view any document
- Regular users: Can only view their own documents
- Unauthenticated: Access denied

**Returns**: Download URL string

**Implementation**:

```typescript
export const getDocumentUrl = query({
  handler: async (ctx, args) => {
    const user = await getUser(ctx).catch(() => null);
    const admin = await getAdminUser(ctx).catch(() => null);

    if (!user && !admin) {
      throw new ConvexError("Not authorized to access this document");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check ownership (unless admin)
    if (!admin && user && document.user_id !== user._id) {
      throw new ConvexError("Not authorized to access this document");
    }

    // Try storage first
    if (document.storage_id) {
      const url = await ctx.storage.getUrl(document.storage_id);
      if (!url) {
        throw new ConvexError("Failed to generate document URL");
      }
      return url;
    }

    // Fallback to external URL
    if (document.file_url) {
      return document.file_url;
    }

    throw new ConvexError("No file available for this document");
  },
});
```

---

### `listMyDocuments()`

Lists all KYC documents for the authenticated user.

**Arguments**: None (uses authenticated user context)

**Returns**: Array of document summaries

**Ordering**: Most recent first (by created_at DESC)

**Implementation**:

```typescript
export const listMyDocuments = query({
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const docs = await ctx.db
      .query(TABLE_NAMES.KYC_DOCUMENTS)
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    docs.sort((a, b) => b.created_at - a.created_at);

    return docs.map((doc) => ({
      _id: doc._id,
      document_type: doc.document_type,
      status: doc.status,
      file_name: doc.file_name,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      uploaded_at: doc.uploaded_at,
      reviewed_by: doc.reviewed_by,
      reviewed_at: doc.reviewed_at,
      rejection_reason: doc.rejection_reason,
      created_at: doc.created_at,
    }));
  },
});
```

---

### `deleteDocument(args)`

Deletes a user's uploaded document.

**Arguments**:

```typescript
{
  documentId: v.id(TABLE_NAMES.KYC_DOCUMENTS);
}
```

**Validation**:

1. User must be document owner
2. Document cannot be approved (only pending/rejected can be deleted)
3. User must be authenticated

**Side Effects**:

1. Deletes file from storage (if storage_id exists)
2. Deletes database record
3. Logs audit event

**Returns**: `null`

**Implementation**:

```typescript
export const deleteDocument = mutation({
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (document.user_id !== user._id) {
      throw new ConvexError("Not authorized to delete this document");
    }

    if (document.status === KYCStatus.APPROVED) {
      throw new ConvexError(
        "Cannot delete approved documents. Please contact support."
      );
    }

    // Delete from storage
    if (document.storage_id) {
      await ctx.storage.delete(document.storage_id);
    }

    // Delete database record
    await ctx.db.delete(document._id);

    // Log audit event
    await auditLog.log(ctx, {
      action: "kyc.document_deleted",
      actorId: user._id,
      resourceType: RESOURCE_TYPE.KYC_DOCUMENTS,
      resourceId: document._id,
      severity: "warning",
      metadata: {
        document_type: document.document_type,
        file_name: document.file_name,
        previous_status: document.status,
      },
    });

    return null;
  },
});
```

---

### `getKycRequirements()`

Returns KYC document requirements for UI display.

**Arguments**: None

**Returns**:

```typescript
{
  required: KycDocumentType[];      // ["government_id", "selfie_with_id"]
  optional: KycDocumentType[];      // ["proof_of_address", "bank_statement"]
  maxFileSize: number;              // 5242880 (5MB)
  allowedMimeTypes: string[];       // ["image/jpeg", "image/png", ...]
}
```

**Usage**: Display requirements in upload UI

---

## Document Status Flow

```
PENDING ──[Admin Review]──> APPROVED
   │                           │
   │                           │
[Delete]                   [Locked]
   │
   ▼
DELETED
```

### Status Values

```typescript
enum KYCStatus {
  PENDING = "pending", // Awaiting admin review
  APPROVED = "approved", // Verified by admin
  REJECTED = "rejected", // Rejected by admin
}
```

---

## Document Structure

### Database Schema

```typescript
type KycDocument = {
  _id: Id<"kyc_documents">;
  user_id: Id<"users">;
  document_type: KycDocumentType;
  storage_id?: Id<"_storage">; // Convex storage reference
  file_url?: string; // External URL (legacy)
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  uploaded_at?: number;
  status: KYCStatus;
  reviewed_by?: Id<"admin_users">;
  reviewed_at?: number;
  rejection_reason?: string;
  created_at: number;
};
```

---

## Error Handling

### Validation Errors

#### Invalid File Type

```typescript
throw new ConvexError(
  `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
);
// Example: "Invalid file type. Allowed: .jpg, .jpeg, .png, .pdf"
```

#### Invalid MIME Type

```typescript
throw new ConvexError(
  `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
);
// Example: "Invalid MIME type. Allowed: image/jpeg, image/png, application/pdf"
```

#### File Too Large

```typescript
throw new ConvexError(
  `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
);
// Example: "File too large. Maximum size: 5MB"
```

#### Duplicate Pending Document

```typescript
throw new ConvexError(`A pending ${args.documentType} document already exists`);
// Example: "A pending government_id document already exists"
```

---

### Authorization Errors

#### Not Authenticated

```typescript
throw new ConvexError("Not authorized to access this document");
```

#### Not Owner

```typescript
throw new ConvexError("Not authorized to delete this document");
```

#### Cannot Delete Approved

```typescript
throw new ConvexError(
  "Cannot delete approved documents. Please contact support."
);
```

---

## Integration Example

### Complete Upload Flow

```typescript
// React component for KYC upload
function KycUploadForm({ documentType }: { documentType: KycDocumentType }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const getUploadUrl = useMutation(kycDocuments.getUploadUrl);
  const uploadDocument = useMutation(kycDocuments.uploadDocument);
  const invalidateList = useQuery(kycDocuments.listMyDocuments);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Get upload URL
      const { uploadUrl } = await getUploadUrl({
        documentType,
        fileName: file.name,
        mimeType: file.type,
      });

      // Step 2: Upload directly to storage
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setProgress(percentComplete);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Step 3: Extract storage ID and confirm upload
          const storageId = extractStorageIdFromUrl(uploadUrl);

          await uploadDocument({
            documentType,
            storageId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });

          toast.success("Document uploaded successfully!");
          invalidateList();
        } else {
          throw new Error("Upload failed");
        }
      };

      xhr.onerror = () => {
        throw new Error("Upload failed");
      };

      xhr.send(file);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      {uploading && <ProgressBar value={progress} />}
    </div>
  );
}
```

---

### Admin Document Review

```typescript
// Admin dashboard - document viewer
function AdminDocumentViewer({ documentId }: { documentId: KycDocumentId }) {
  const documentUrl = useQuery(kycDocuments.getDocumentUrl, { documentId });
  const document = useQuery(kycDocuments.getMyDocument, { documentId });

  if (!documentUrl || !document) return <LoadingSpinner />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{document.document_type}</CardTitle>
        <CardDescription>
          Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {document.mime_type?.includes("pdf") ? (
          <iframe
            src={documentUrl}
            className="w-full h-[600px]"
            title="Document preview"
          />
        ) : (
          <img
            src={documentUrl}
            alt={document.document_type}
            className="max-w-full h-auto"
          />
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          <p>File size: {(document.file_size / 1024 / 1024).toFixed(2)} MB</p>
          <p>MIME type: {document.mime_type}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Testing Checklist

### Unit Tests

```typescript
describe("validateFileName", () => {
  test("should accept valid extensions", () => {
    expect(() => validateFileName("photo.jpg")).not.toThrow();
    expect(() => validateFileName("document.PNG")).not.toThrow();
    expect(() => validateFileName("scan.pdf")).not.toThrow();
  });

  test("should reject invalid extensions", () => {
    expect(() => validateFileName("photo.gif")).toThrow("Invalid file type");
    expect(() => validateFileName("document.exe")).toThrow("Invalid file type");
  });
});

describe("getUploadUrl", () => {
  test("should generate upload URL for valid request", async () => {
    const result = await ctx.runMutation(kycDocuments.getUploadUrl, {
      documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
      fileName: "passport.jpg",
      mimeType: "image/jpeg",
    });

    expect(result.uploadUrl).toBeDefined();
    expect(result.uploadUrl).toContain("https://");
  });

  test("should reject invalid MIME type", async () => {
    await expect(
      ctx.runMutation(kycDocuments.getUploadUrl, {
        documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
        fileName: "photo.gif",
        mimeType: "image/gif",
      })
    ).rejects.toThrow("Invalid MIME type");
  });
});

describe("uploadDocument", () => {
  test("should create document record successfully", async () => {
    const result = await ctx.runMutation(kycDocuments.uploadDocument, {
      documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
      storageId: "storage:123" as any,
      fileName: "passport.jpg",
      fileSize: 1024 * 1024, // 1MB
      mimeType: "image/jpeg",
    });

    expect(result._id).toBeDefined();
    expect(result.status).toBe(KYCStatus.PENDING);
    expect(result.file_name).toBe("passport.jpg");
  });

  test("should reject file larger than max size", async () => {
    await expect(
      ctx.runMutation(kycDocuments.uploadDocument, {
        documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
        storageId: "storage:123" as any,
        fileName: "large.zip",
        fileSize: 20 * 1024 * 1024, // 20MB
        mimeType: "application/zip",
      })
    ).rejects.toThrow("File too large");
  });

  test("should prevent duplicate pending documents", async () => {
    // First upload
    await ctx.runMutation(kycDocuments.uploadDocument, {
      documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
      storageId: "storage:123" as any,
      fileName: "passport1.jpg",
      fileSize: 1024 * 1024,
      mimeType: "image/jpeg",
    });

    // Second upload should fail
    await expect(
      ctx.runMutation(kycDocuments.uploadDocument, {
        documentType: DOCUMENT_TYPES.GOVERNMENT_ID,
        storageId: "storage:456" as any,
        fileName: "passport2.jpg",
        fileSize: 1024 * 1024,
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow("already exists");
  });
});

describe("deleteDocument", () => {
  test("should delete pending document", async () => {
    const docId = await createTestDocument({ status: KYCStatus.PENDING });

    const result = await ctx.runMutation(kycDocuments.deleteDocument, {
      documentId: docId,
    });

    expect(result).toBe(null);

    // Verify deletion
    const deleted = await ctx.db.get(docId);
    expect(deleted).toBeNull();
  });

  test("should prevent deleting approved document", async () => {
    const docId = await createTestDocument({ status: KYCStatus.APPROVED });

    await expect(
      ctx.runMutation(kycDocuments.deleteDocument, { documentId: docId })
    ).rejects.toThrow("Cannot delete approved documents");
  });
});
```

---

## Security Considerations

⚠️ **Critical Security Points**:

1. **Direct-to-storage uploads**

   - Files bypass backend (faster, more efficient)
   - Pre-signed URLs are single-use
   - Validation happens before URL generation

2. **Access control enforcement**

   - Users can only view their own documents
   - Admins can view all documents
   - Authentication required for all operations

3. **File type restrictions**

   - Only safe MIME types allowed
   - Extension validation prevents executable uploads
   - Size limits prevent DoS attacks

4. **Audit logging**

   - All uploads logged with metadata
   - Deletions logged with previous state
   - Full compliance trail

5. **Approved document protection**
   - Cannot delete approved documents
   - Prevents evidence destruction
   - Requires admin intervention for removal

---

## Performance Optimization

### Query Indexes

All queries use indexes for fast lookups:

```typescript
// By user ID and status
.withIndex("by_user_id_and_status", q =>
  q.eq("user_id", userId).eq("status", status)
)

// By user ID only
.withIndex("by_user_id", q => q.eq("user_id", userId))

// By status only (for admin review queue)
.withIndex("by_status", q => q.eq("status", KYCStatus.PENDING))
```

### Upload Strategy

**Direct-to-Storage Benefits**:

- No backend bandwidth consumption
- Faster uploads (direct path)
- Automatic retry on failure
- Progress tracking available

**Batch Operations**:

```typescript
// Fetch all documents once
const allDocs = useQuery(kycDocuments.listMyDocuments);

// Group by type
const docsByType = useMemo(() => {
  const grouped = {};
  allDocs?.forEach((doc) => {
    grouped[doc.document_type] = doc;
  });
  return grouped;
}, [allDocs]);
```

---

## Monitoring Recommendations

Track these metrics:

```typescript
// Document upload counts by type
const uploadsByType = {
  government_id: count(docs, (d) => d.document_type === "government_id"),
  selfie_with_id: count(docs, (d) => d.document_type === "selfie_with_id"),
  proof_of_address: count(docs, (d) => d.document_type === "proof_of_address"),
};

// Average file sizes
const avgFileSize =
  docs.reduce((sum, d) => sum + (d.file_size || 0), 0) / docs.length;

// Approval rate
const approvalRate = approvedDocs.length / totalDocs.length;

// Time to review
const avgReviewTime =
  approvedDocs.reduce(
    (sum, doc) => sum + (doc.reviewed_at - doc.created_at),
    0
  ) / approvedDocs.length;
```

---

## Related Files

- [`kyc.ts`](./kyc.md) - KYC verification pipeline
- [`auditLog.ts`](./auditLog.md) - Audit trail system
- [`shared.ts`](./shared.md) - Enum and constant definitions
- [`types.ts`](./types.md) - TypeScript type definitions

---

## Quick Reference

### File Requirements Table

| Property   | Value                                             |
| ---------- | ------------------------------------------------- |
| Max Size   | 5 MB                                             |
| Extensions | .jpg, .jpeg, .png, .pdf                           |
| MIME Types | image/jpeg, image/png, application/pdf |

### Document Types

| Type             | Required?   | Description                                |
| ---------------- | ----------- | ------------------------------------------ |
| GOVERNMENT_ID    | ✅ Yes      | National ID, Passport, or Driver's License |
| SELFIE_WITH_ID   | ✅ Yes      | Photo of user holding the government ID    |
| PROOF_OF_ADDRESS | ❌ Optional | Utility bill or similar                    |
| BANK_STATEMENT   | ❌ Optional | Financial institution statement            |

### Status Meanings

| Status   | Meaning         | Can Delete? |
| -------- | --------------- | ----------- |
| PENDING  | Awaiting review | ✅ Yes      |
| APPROVED | Verified        | ❌ No       |
| REJECTED | Denied          | ✅ Yes      |

---

## Changelog

- **Initial Implementation**: Basic document upload and retrieval
- **Storage Integration**: Migrated to Convex native storage
- **Audit Logging**: Added comprehensive audit trail
- **Duplicate Prevention**: Prevent multiple pending documents of same type
- **Enhanced Validation**: Stricter file type and size checks
