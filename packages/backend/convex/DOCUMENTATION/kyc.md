# KYC Feature Behavior

## Overview

**Primary modules**:

- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/kyc.ts`
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/kycDocuments.ts`
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/kycInternal.ts`

The KYC feature is a document-backed identity verification pipeline with two decision paths:

1. **Automated verification**
   - user triggers verification
   - provider adapter returns a decision
   - shared decision logic applies the outcome

2. **Manual admin review**
   - admin reviews pending users/documents
   - admin approves or rejects
   - the exact same shared decision logic applies the outcome

The important current behavior is:

- KYC rejection is **retryable**.
- Rejection returns the user to `pending_kyc`.
- Rejected documents remain in history.
- Replacement uploads supersede prior rejected documents of the same type.

This is different from the older model that moved rejected users to `closed`.

---

## Core Modules

### API / Orchestration
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/kyc.ts`
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/kycDocuments.ts`
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/users.ts`

### Internal provider/query helpers
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/kycInternal.ts`

### Domain rules
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/domain/src/services/kycPolicy.ts`

### Application use cases
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/application/src/use-cases/index.ts`

### Backend adapters
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/adapters/kycAdapters.ts`
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/adapters/userAdapters.ts`

---

## KYC State Model

## User status

Relevant user statuses:

- `pending_kyc`
  - user can upload documents
  - user can run automated verification
  - admin can review pending docs

- `active`
  - KYC approved
  - full access granted

Current rejection behavior:

- rejection does **not** move the user to `closed`
- rejection moves the user back to `pending_kyc`
- user may upload replacement documents and retry

## Document status

KYC document statuses:

- `pending`
- `approved`
- `rejected`

Only `pending` documents participate in a verification run.

---

## Required Documents

The required document set is currently:

- `government_id`
- `selfie_with_id`

Optional documents:

- `proof_of_address`
- `bank_statement`

A verification run is blocked until all required document types exist in `pending` status.

---

## Persistence Model

### `kyc_documents`

This table stores document metadata and review outcome history.

Important fields:

- `user_id`
- `document_type`
- `status`
- `file_url` (legacy compatibility)
- `storage_id`
- `file_name`
- `file_size`
- `mime_type`
- `uploaded_at`
- `reviewed_by`
- `reviewed_at`
- `rejection_reason`
- `supersedes_document_id`
- `created_at`

### `supersedes_document_id`

This field links a fresh upload to the most recent rejected document of the same type.

Meaning:

- rejected documents are retained
- replacement uploads do not overwrite old records
- the chain of attempts remains auditable

---

## Upload Behavior

## Step 1: `kycDocuments.getUploadUrl`

This mutation validates file name and MIME type and returns a Convex upload URL.

It does **not** create a database row.

## Step 2: client uploads directly to storage

The client uploads bytes to the returned URL.

## Step 3: `kycDocuments.uploadDocument`

This mutation finalizes the document record.

### Preconditions

1. User must be authenticated.
2. User must still be in `pending_kyc`.
3. File size must be within limits.
4. File extension and MIME type must be allowed.
5. There must not already be another `pending` document of the same type for that user.

### Replacement behavior

If the user previously uploaded a rejected document of the same type:

- the new record is allowed
- `supersedes_document_id` is set to the latest rejected document of that type

### What gets written

A new `kyc_documents` row is inserted with:

- `status = pending`
- file metadata
- storage linkage
- optional `supersedes_document_id`

### What does **not** happen

- Existing rejected docs are not modified.
- Existing approved docs are not replaced.
- Verification does not run automatically on upload.

---

## Document Deletion Behavior

## Entry point

- `kycDocuments.deleteDocument`

## Rules

A user may delete only their own documents.

Deletion rules by status:

- `approved`
  - cannot be deleted
- `pending`
  - can be deleted
- `rejected`
  - can be deleted

When deletion succeeds:

1. The document row is deleted through the KYC document repository.
2. If the row had a `storage_id`, the file is deleted from Convex storage.
3. An audit event is recorded.

This preserves the rule that approved evidence cannot be removed by the user.

---

## Automated Verification Behavior

## Entry point

- `kyc.verifyIdentity`

## Preconditions

1. User must be authenticated.
2. User must be in `pending_kyc`.
3. There must be pending KYC documents.
4. Required document types must be present among those pending docs.

## Runtime flow

1. Fetch viewer user + pending documents via `kycInternal.getViewerKycData`.
2. Build static repository adapters for the action context.
3. Run `createRunAutomatedKycUseCase`.
4. Call the provider adapter via `kycInternal.simulateKycProvider`.
5. Apply the resulting decision through `internal.users.processKycResult`.

## Current provider behavior

The provider is still simulated.

Current properties:

- async action
- artificial delay
- random approve/reject outcome
- returns:
  - `approved`
  - `reason`
  - `providerReference`
  - `metadata`

The orchestration is already provider-ready. Replacing the stub with a real provider should not require changing the feature’s domain workflow.

---

## Manual Review Behavior

## Queue query

- `kyc.adminListPendingKyc`

This query returns pending KYC review rows grouped by user, including pending document metadata.

Each row includes:

- `user_id`
- identity fields
- current user status
- `pending_documents`

Document summaries include:

- `document_id`
- `document_type`
- `created_at`
- `uploaded_at`
- `file_name`
- `file_size`
- `mime_type`
- `supersedes_document_id`

## Decision mutation

- `kyc.adminReviewKyc`

### Rules

1. Caller must be an authenticated admin.
2. If rejecting, a reason is required.
3. Manual review uses the same shared decision path as automated review.

This is important because it prevents the admin path and the automated path from diverging semantically.

---

## Shared Decision Application

## Internal decision application path

Both automated verification and admin review end in:

- `internal.users.processKycResult`
- which delegates to `createApplyKycDecisionUseCase`

## Approval outcome

If `approved = true`:

- user status becomes `active`
- all currently pending KYC documents become `approved`
- `reviewed_by` / `reviewed_at` are stored where available

## Rejection outcome

If `approved = false`:

- user status becomes `pending_kyc`
- all currently pending KYC documents become `rejected`
- `rejection_reason` is stored
- `reviewed_by` / `reviewed_at` are stored where available

The user can then upload replacements and retry.

---

## Important Behavioral Semantics

## Only pending documents are reviewed

Previously uploaded approved or rejected documents do not participate in the active decision run.

The current decision scope is:

- `findByUserIdAndStatus(userId, "pending")`

That means each review cycle acts on a clean pending batch.

## Rejection is retryable

This is the most important KYC behavior in the current system.

A rejection means:

- current attempt failed
- current pending docs were marked rejected
- user is still eligible to try again

It does **not** mean the account is permanently closed.

## Supersession preserves history

If the user re-uploads a document type after rejection:

- old rejected document remains
- new pending document points back via `supersedes_document_id`
- reviewers and auditors can follow the chain of attempts

---

## Access Control

## User access

A user can:

- request upload URLs
- upload KYC documents
- list their own KYC documents
- delete their own pending/rejected documents
- run automated verification for their own account
- view their own document URLs

## Admin access

An admin can:

- list pending KYC review items
- review KYC manually
- open document URLs for review

Document URL access is controlled in `kycDocuments.getDocumentUrl`:

- admins may access any KYC document
- users may access only their own documents

---

## File Validation Rules

Validation is enforced before finalizing uploads.

Current constraints come from shared constants in `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/shared.ts`.

Important points:

- file name extension must be allowed
- MIME type must be allowed
- max file size must be respected

The code is authoritative for exact current limits.

---

## Audit Behavior

KYC flow writes audit information for:

- document upload
- document delete
- decision application
- final KYC completed/failed event on the user record path

Important actions include:

- `kyc.document_uploaded`
- `kyc.document_deleted`
- `kyc.decision_applied`
- `KYC_VERIFICATION_COMPLETED`
- `KYC_VERIFICATION_FAILED`

This gives both document-level and user-level audit history.

---

## Invariants

These are the main invariants to preserve in future changes:

1. A user must be `pending_kyc` to run verification.
2. Required docs must be present in `pending` status before verification runs.
3. Only pending docs are affected by a decision.
4. Approval moves the user to `active`.
5. Rejection moves the user back to `pending_kyc`.
6. Rejected docs remain historical.
7. Replacement docs supersede the latest rejected doc of the same type.
8. Approved docs cannot be user-deleted.
9. Manual and automated decisions must converge on the same persistence path.

---

## Operational Notes

1. If a user says “I was rejected and uploaded new documents,” the correct expectation is another pending review cycle, not account reactivation by default.
2. If there are no pending docs, automated verification should fail fast.
3. If required docs are missing from the pending set, verification should fail fast.
4. If a user has both approved historical docs and new pending docs, the new decision only affects the pending set.

---

## Related Documentation

- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/DOCUMENTATION/kycDocuments.md`
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/DOCUMENTATION/risk.md`
- `/Users/michael/Private/projects/better-t-stack/avm-daily/packages/backend/convex/DOCUMENTATION/RISK_KYC_POLICY_SUMMARY.md`
