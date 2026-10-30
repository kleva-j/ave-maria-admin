import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import type { TwentyCrmEntityType } from "./twentyCrmOutbox";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { twentyCrmEntityType } from "./schemas/twentyCrmSync";
import { enqueueTwentyCrmRecord } from "./twentyCrmOutbox";
import { AdminRole } from "./shared";
import { getAdminUser } from "./utils";

const MAX_ATTEMPTS = 12;
const LEASE_MS = 5 * 60_000;
const BACKFILL_PAGE_SIZE = 100;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60_000;

const operationValidator = v.union(v.literal("upsert"), v.literal("delete"));
const sourcePayloadValidator = v.any();

const backfillPasses: Array<{
  entityType: TwentyCrmEntityType;
  mode: "all" | "recent" | "active";
  status?: string;
}> = [
  { entityType: "person", mode: "all" },
  { entityType: "withdrawal", mode: "recent" },
  { entityType: "withdrawal", mode: "active", status: "pending" },
  { entityType: "withdrawal", mode: "active", status: "approved" },
  { entityType: "kyc_document", mode: "recent" },
  { entityType: "kyc_document", mode: "active", status: "pending" },
  { entityType: "risk_hold", mode: "recent" },
  { entityType: "risk_hold", mode: "active", status: "active" },
  { entityType: "savings_plan", mode: "recent" },
  { entityType: "savings_plan", mode: "active", status: "active" },
  { entityType: "bank_account", mode: "all" },
  { entityType: "transaction", mode: "recent" },
];

function sanitizeOperationalReason(value: string | undefined): string | null {
  if (!value) return null;
  // Staff-entered free text can contain names, identity numbers, or account
  // details that cannot be reliably removed with pattern matching. Emit only
  // a small operational category when its meaning is clear.
  const categories: Array<[RegExp, string]> = [
    [/\b(expired|expiration)\b/i, "Expired"],
    [/\b(blurry|blurred|unreadable|illegible)\b/i, "Unreadable"],
    [/\b(mismatch|does not match|not matching)\b/i, "Information mismatch"],
    [/\b(missing|not provided)\b/i, "Missing information"],
    [/\b(incomplete|incompletely)\b/i, "Incomplete"],
    [/\b(duplicate|already submitted)\b/i, "Duplicate"],
    [/\b(unsupported|not accepted)\b/i, "Unsupported document"],
    [/\b(invalid|not valid)\b/i, "Invalid"],
    [/\b(suspicious|fraud)\b/i, "Requires review"],
  ];
  return categories.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

type PreparedRecord = {
  endpoint: string;
  externalId: string;
  fields: Record<string, unknown>;
  owner?: {
    entityId: string;
  };
};

function asDate(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asDateString(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asSafeInteger(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new TwentyResponseError(400, "amount_out_of_safe_integer_range");
  }
  return number;
}

function personFields(user: {
  workosId: string;
  email?: string;
  phone: string;
  first_name: string;
  last_name: string;
  total_balance_kobo: bigint;
  savings_balance_kobo: bigint;
  status: string;
  referral_code: string;
}) {
  return {
    name: { firstName: user.first_name, lastName: user.last_name },
    ...(user.email ? { emails: { primaryEmail: user.email } } : {}),
    ...(user.phone ? { phones: { primaryPhoneNumber: user.phone } } : {}),
    avmUserId: user.workosId,
    avmAccountStatus: user.status,
    avmLedgerBalanceKobo: Number(user.total_balance_kobo),
    avmAvailableBalanceKobo: asSafeInteger(
      user.total_balance_kobo - user.savings_balance_kobo,
    ),
    avmReferralCode: user.referral_code,
    avmAnonymized: false,
  };
}

async function loadPreparedRecord(
  ctx: QueryCtx,
  entityType: TwentyCrmEntityType,
  entityId: string,
): Promise<PreparedRecord | null> {
  const id = entityId;
  if (entityType === "person") {
    const user = (await ctx.db.get("users", id as Id<"users">)) as
      | {
          _id: Id<"users">;
          workosId: string;
          email?: string;
          phone: string;
          first_name: string;
          last_name: string;
          total_balance_kobo: bigint;
          savings_balance_kobo: bigint;
          status: string;
          referral_code: string;
          deleted_at?: number;
        }
      | null;
    if (!user || user.deleted_at !== undefined) return null;
    return {
      endpoint: "people",
      externalId: user.workosId,
      fields: personFields(user),
    };
  }

  let source: {
    _id: string;
    [key: string]: unknown;
  } | null = null;
  let ownerId: Id<"users"> | undefined;
  let endpoint = "";
  if (entityType === "withdrawal") {
    const withdrawal = await ctx.db.get("withdrawals", id as Id<"withdrawals">);
    source = withdrawal;
    ownerId = withdrawal?.requested_by;
    endpoint = "avmWithdrawals";
  } else if (entityType === "kyc_document") {
    const document = await ctx.db.get("kyc_documents", id as Id<"kyc_documents">);
    source = document;
    ownerId = document?.user_id;
    endpoint = "avmKycDocuments";
  } else if (entityType === "risk_hold") {
    const hold = await ctx.db.get("user_risk_holds", id as Id<"user_risk_holds">);
    source = hold;
    ownerId = hold?.user_id;
    endpoint = "avmRiskHolds";
  } else if (entityType === "savings_plan") {
    const plan = await ctx.db.get("user_savings_plans", id as Id<"user_savings_plans">);
    source = plan;
    ownerId = plan?.user_id;
    endpoint = "avmSavingsPlans";
  } else if (entityType === "bank_account") {
    const account = await ctx.db.get("user_bank_accounts", id as Id<"user_bank_accounts">);
    source = account;
    ownerId = account?.user_id;
    endpoint = "avmBankAccounts";
  } else {
    const transaction = await ctx.db.get("transactions", id as Id<"transactions">);
    source = transaction;
    ownerId = transaction?.user_id;
    endpoint = "avmTransactions";
  }

  if (!source || !ownerId) return null;
  const user = (await ctx.db.get("users", ownerId)) as
    | {
        workosId: string;
        email?: string;
        phone: string;
        first_name: string;
        last_name: string;
        total_balance_kobo: bigint;
        savings_balance_kobo: bigint;
        status: string;
        referral_code: string;
        deleted_at?: number;
      }
    | null;
  if (!user || user.deleted_at !== undefined) return null;

  let fields: Record<string, unknown>;
  if (entityType === "withdrawal") {
    fields = {
      externalId: id,
      avmUserId: user.workosId,
      reference: source.reference ?? `legacy_${id}`,
      amountKobo: asSafeInteger(source.requested_amount_kobo as bigint),
      status: source.status,
      occurredAt: asDate(source.requested_at as number),
      sourceUpdatedAt: asDate(
        (source.processed_at ?? source.approved_at ?? source.requested_at) as number,
      ),
      savingsPlanId: null,
      reversalReference: null,
    };
  } else if (entityType === "kyc_document") {
    fields = {
      externalId: id,
      avmUserId: user.workosId,
      documentType: source.document_type,
      status: source.status,
      uploadedAt: asDate(source.uploaded_at as number | undefined),
      reviewedAt: asDate(source.reviewed_at as number | undefined),
      sanitizedRejectionReason: sanitizeOperationalReason(
        source.rejection_reason as string | undefined,
      ),
    };
  } else if (entityType === "risk_hold") {
    fields = {
      externalId: id,
      avmUserId: user.workosId,
      status: source.status,
      reason:
        sanitizeOperationalReason(source.reason as string | undefined) ??
        "Requires review",
      sourceCreatedAt: asDate(source.placed_at as number),
      releasedAt: asDate(source.released_at as number | undefined),
    };
  } else if (entityType === "savings_plan") {
    const plan = source;
    const template = (await ctx.db.get(
      "savings_plan_templates",
      plan.template_id as Id<"savings_plan_templates">,
    )) as { name: string } | null;
    fields = {
      externalId: id,
      avmUserId: user.workosId,
      planType: template?.name ?? "unknown",
      status: plan.status,
      balanceKobo: asSafeInteger(plan.current_amount_kobo as bigint),
      targetAmountKobo:
        plan.custom_target_kobo === undefined
          ? null
          : asSafeInteger(plan.custom_target_kobo as bigint),
      startedAt:
        asDateString(plan.start_date as string | undefined) ??
        asDate(plan.created_at as number),
      maturesAt: asDateString(plan.end_date as string | undefined),
    };
  } else if (entityType === "bank_account") {
    const accountNumber = String(source.account_number ?? "");
    fields = {
      externalId: id,
      avmUserId: user.workosId,
      bankName: source.bank_name,
      accountName: source.account_name ?? null,
      lastFourDigits: accountNumber.length >= 4 ? accountNumber.slice(-4) : "****",
      verificationStatus: source.verification_status,
      isCurrent: source.is_primary,
    };
  } else {
    fields = {
      externalId: id,
      avmUserId: user.workosId,
      reference: source.reference,
      transactionType: source.type,
      amountKobo: asSafeInteger(source.amount_kobo as bigint),
      occurredAt: asDate(source.created_at as number),
      savingsPlanId: source.user_plan_id ? String(source.user_plan_id) : null,
      reversalReference: source.reversal_of_reference ?? null,
    };
  }

  return {
    endpoint,
    externalId: id,
    fields: { ...fields, personId: undefined },
    owner: {
      entityId: String(ownerId),
    },
  };
}

export const getRecordPayload = internalQuery({
  args: { entityType: twentyCrmEntityType, entityId: v.string() },
  returns: sourcePayloadValidator,
  handler: async (ctx, args) =>
    await loadPreparedRecord(ctx, args.entityType, args.entityId),
});

export const getRecordLink = internalQuery({
  args: { entityType: twentyCrmEntityType, entityId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("twenty_crm_record_links")
      .withIndex("by_entity_type_and_entity_id", (q) =>
        q.eq("entity_type", args.entityType).eq("entity_id", args.entityId),
      )
      .unique();
    return link?.twenty_record_id ?? null;
  },
});

export const upsertRecordLink = internalMutation({
  args: {
    entityType: twentyCrmEntityType,
    entityId: v.string(),
    twentyRecordId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("twenty_crm_record_links")
      .withIndex("by_entity_type_and_entity_id", (q) =>
        q.eq("entity_type", args.entityType).eq("entity_id", args.entityId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch("twenty_crm_record_links", existing._id, {
        twenty_record_id: args.twentyRecordId,
        synced_at: Date.now(),
      });
    } else {
      await ctx.db.insert("twenty_crm_record_links", {
        entity_type: args.entityType,
        entity_id: args.entityId,
        twenty_record_id: args.twentyRecordId,
        synced_at: Date.now(),
      });
    }
    return null;
  },
});

export const deleteRecordLink = internalMutation({
  args: { entityType: twentyCrmEntityType, entityId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("twenty_crm_record_links")
      .withIndex("by_entity_type_and_entity_id", (q) =>
        q.eq("entity_type", args.entityType).eq("entity_id", args.entityId),
      )
      .unique();
    if (link) await ctx.db.delete("twenty_crm_record_links", link._id);
    return null;
  },
});

export const claim = internalMutation({
  args: { outboxId: v.id("twenty_crm_outbox") },
  returns: v.union(
    v.null(),
    v.object({
      entityType: twentyCrmEntityType,
      entityId: v.string(),
      operation: operationValidator,
      revision: v.number(),
      attempt: v.number(),
      leaseToken: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("twenty_crm_outbox", args.outboxId);
    if (!row || row.status === "delivered" || row.status === "failed") {
      return null;
    }
    const now = Date.now();
    if (row.next_attempt_at > now) return null;
    if (
      row.status === "processing" &&
      (row.lease_expires_at ?? 0) > now
    ) {
      return null;
    }
    const leaseToken = crypto.randomUUID();
    const attempt = row.attempt_count + 1;
    await ctx.db.patch("twenty_crm_outbox", row._id, {
      status: "processing",
      attempt_count: attempt,
      lease_token: leaseToken,
      lease_expires_at: now + LEASE_MS,
      updated_at: now,
    });
    return {
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      revision: row.revision,
      attempt,
      leaseToken,
    };
  },
});

export const finish = internalMutation({
  args: {
    outboxId: v.id("twenty_crm_outbox"),
    revision: v.number(),
    leaseToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("twenty_crm_outbox", args.outboxId);
    if (!row || row.lease_token !== args.leaseToken) return null;
    const now = Date.now();
    if (row.revision !== args.revision) {
      await ctx.db.patch("twenty_crm_outbox", row._id, {
        status: "pending",
        next_attempt_at: now,
        lease_token: undefined,
        lease_expires_at: undefined,
        updated_at: now,
      });
      await ctx.scheduler.runAfter(0, internal.twentySync.deliver, {
        outboxId: row._id,
      });
      return null;
    }
    await ctx.db.patch("twenty_crm_outbox", row._id, {
      status: "delivered",
      delivered_at: now,
      lease_token: undefined,
      lease_expires_at: undefined,
      last_error: undefined,
      updated_at: now,
    });
    return null;
  },
});

export const fail = internalMutation({
  args: {
    outboxId: v.id("twenty_crm_outbox"),
    revision: v.number(),
    leaseToken: v.string(),
    retryable: v.boolean(),
    errorCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("twenty_crm_outbox", args.outboxId);
    if (!row || row.lease_token !== args.leaseToken) return null;
    const now = Date.now();
    if (row.revision !== args.revision) {
      await ctx.db.patch("twenty_crm_outbox", row._id, {
        status: "pending",
        next_attempt_at: now,
        lease_token: undefined,
        lease_expires_at: undefined,
        updated_at: now,
      });
      await ctx.scheduler.runAfter(0, internal.twentySync.deliver, {
        outboxId: row._id,
      });
      return null;
    }

    const canRetry = args.retryable && row.attempt_count < MAX_ATTEMPTS;
    const delay = Math.min(
      30_000 * 2 ** Math.max(0, row.attempt_count - 1),
      MAX_RETRY_DELAY_MS,
    );
    await ctx.db.patch("twenty_crm_outbox", row._id, {
      status: canRetry ? "retry" : "failed",
      next_attempt_at: canRetry ? now + delay : now,
      lease_token: undefined,
      lease_expires_at: undefined,
      last_error: args.errorCode.slice(0, 80),
      updated_at: now,
    });
    if (canRetry) {
      await ctx.scheduler.runAfter(delay, internal.twentySync.deliver, {
        outboxId: row._id,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.adminAlerts.upsertSharedAlert, {
        alertType: "twenty_crm_sync_failed",
        severity: "critical",
        title: "Twenty CRM synchronization failed",
        body:
          "One or more CRM records exhausted automatic delivery retries. Review the Twenty sync queue, correct configuration or API errors, and replay failed records.",
        fingerprint: "twenty_crm_sync_failed",
        metadata: { errorCode: args.errorCode.slice(0, 80) },
      });
    }
    return null;
  },
});

export const deleteLinkAndComplete = internalMutation({
  args: {
    outboxId: v.id("twenty_crm_outbox"),
    entityType: twentyCrmEntityType,
    entityId: v.string(),
    revision: v.number(),
    leaseToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("twenty_crm_outbox", args.outboxId);
    if (!row || row.lease_token !== args.leaseToken) return null;
    const link = await ctx.db
      .query("twenty_crm_record_links")
      .withIndex("by_entity_type_and_entity_id", (q) =>
        q.eq("entity_type", args.entityType).eq("entity_id", args.entityId),
      )
      .unique();
    if (link) await ctx.db.delete("twenty_crm_record_links", link._id);
    const now = Date.now();
    if (row.revision !== args.revision) {
      await ctx.db.patch("twenty_crm_outbox", row._id, {
        status: "pending",
        next_attempt_at: now,
        lease_token: undefined,
        lease_expires_at: undefined,
        updated_at: now,
      });
      await ctx.scheduler.runAfter(0, internal.twentySync.deliver, {
        outboxId: row._id,
      });
    } else {
      await ctx.db.patch("twenty_crm_outbox", row._id, {
        status: "delivered",
        delivered_at: now,
        lease_token: undefined,
        lease_expires_at: undefined,
        updated_at: now,
      });
    }
    return null;
  },
});

class TwentyResponseError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function getConnection() {
  const baseUrl = process.env.TWENTY_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.TWENTY_API_KEY?.trim();
  if (!baseUrl || !apiKey) throw new TwentyResponseError(0, "missing_credentials");
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TwentyResponseError(400, "invalid_base_url");
  }
  if (url.protocol !== "https:") {
    throw new TwentyResponseError(400, "base_url_must_use_https");
  }
  return { baseUrl, apiKey };
}

async function requestTwenty(
  url: string,
  method: string,
  apiKey: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new TwentyResponseError(0, "network_error");
  }
  if (!response.ok) {
    throw new TwentyResponseError(response.status, `http_${response.status}`);
  }
  if (method === "DELETE" || response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new TwentyResponseError(response.status, "invalid_json_response");
  }
}

function responseRecordId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const top = result as Record<string, unknown>;
  const data = top.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataRecord = data as Record<string, unknown>;
    const directId = dataRecord.id;
    if (typeof directId === "string") return directId;
    for (const value of Object.values(dataRecord)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const nestedId = (value as Record<string, unknown>).id;
      if (typeof nestedId === "string") return nestedId;
    }
    return null;
  }
  const id = top.id;
  return typeof id === "string" ? id : null;
}

function responseRecords(result: unknown): Array<Record<string, unknown>> {
  if (!result || typeof result !== "object") return [];
  const top = result as Record<string, unknown>;
  const envelope = top.data;
  const data = Array.isArray(envelope)
    ? envelope
    : envelope && typeof envelope === "object"
      ? (Object.values(envelope as Record<string, unknown>).find(Array.isArray) ?? [])
      : [];
  return data.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item),
  );
}

async function upsertTwentyRecord(
  baseUrl: string,
  apiKey: string,
  endpoint: string,
  externalField: string,
  externalId: string,
  fields: Record<string, unknown>,
  linkedId?: string | null,
  knownId?: string | null,
): Promise<string> {
  const payload = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  if (linkedId) payload.personId = linkedId;
  const path = `${baseUrl}/rest/${endpoint}`;
  let existingId: string | null = knownId ?? null;
  if (existingId) {
    try {
      const result = await requestTwenty(
        `${path}/${encodeURIComponent(existingId)}`,
        "PATCH",
        apiKey,
        payload,
      );
      return responseRecordId(result) ?? existingId;
    } catch (error) {
      if (!(error instanceof TwentyResponseError && error.status === 404)) {
        throw error;
      }
      existingId = null;
    }
  }
  if (!existingId) {
    const searchUrl = new URL(path);
    searchUrl.searchParams.set(
      "filter",
      `${externalField}[eq]:${JSON.stringify(externalId)}`,
    );
    searchUrl.searchParams.set("limit", "2");
    const existingResponse = await requestTwenty(
      searchUrl.toString(),
      "GET",
      apiKey,
    );
    const records = responseRecords(existingResponse);
    if (records.length > 1) {
      throw new TwentyResponseError(422, "ambiguous_external_id_lookup");
    }
    const matchedRecord = records[0];
    if (matchedRecord && matchedRecord[externalField] !== externalId) {
      throw new TwentyResponseError(422, "external_id_lookup_mismatch");
    }
    if (matchedRecord) {
      if (typeof matchedRecord.id !== "string") {
        throw new TwentyResponseError(502, "missing_lookup_record_id");
      }
      existingId = matchedRecord.id;
    }
  }
  const result = existingId
    ? await requestTwenty(
        `${path}/${encodeURIComponent(existingId)}`,
        "PATCH",
        apiKey,
        payload,
      )
    : await requestTwenty(path, "POST", apiKey, payload);
  const id = responseRecordId(result) ?? (typeof existingId === "string" ? existingId : null);
  if (!id) throw new TwentyResponseError(502, "missing_record_id");
  return id;
}

export const deliver = internalAction({
  args: { outboxId: v.id("twenty_crm_outbox") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(internal.twentySync.claim, args);
    if (!job) return null;
    try {
      const { baseUrl, apiKey } = getConnection();
      const mappedId: string | null = await ctx.runQuery(
        internal.twentySync.getRecordLink,
        { entityType: job.entityType, entityId: job.entityId },
      );
      if (job.operation === "delete") {
        if (mappedId) {
          try {
            await requestTwenty(
              `${baseUrl}/rest/${endpointFor(job.entityType)}/${encodeURIComponent(mappedId)}`,
              "DELETE",
              apiKey,
            );
          } catch (error) {
            if (!(error instanceof TwentyResponseError && error.status === 404)) {
              throw error;
            }
          }
        }
        await ctx.runMutation(internal.twentySync.deleteLinkAndComplete, {
          outboxId: args.outboxId,
          entityType: job.entityType,
          entityId: job.entityId,
          revision: job.revision,
          leaseToken: job.leaseToken,
        });
        return null;
      }

      const prepared = (await ctx.runQuery(internal.twentySync.getRecordPayload, {
        entityType: job.entityType,
        entityId: job.entityId,
      })) as PreparedRecord | null;
      // A source record may have been hard-deleted before its queued upsert ran.
      // Deletion/anonymization policies are handled by the dedicated lifecycle phase.
      if (!prepared) {
        await ctx.runMutation(internal.twentySync.finish, {
          outboxId: args.outboxId,
          revision: job.revision,
          leaseToken: job.leaseToken,
        });
        return null;
      }

      let personId: string | null = null;
      if (prepared.owner) {
        const knownPersonId: string | null = await ctx.runQuery(
          internal.twentySync.getRecordLink,
          { entityType: "person", entityId: prepared.owner.entityId },
        );
        if (!knownPersonId) {
          // Keep one writer responsible for each person. This prevents a
          // person event and child-record event from racing and creating two
          // records for the same WorkOS ID.
          await ctx.runMutation(internal.twentySync.enqueueRecords, {
            records: [{ entityType: "person", entityId: prepared.owner.entityId }],
          });
          throw new TwentyResponseError(503, "person_link_not_ready");
        }
        personId = knownPersonId;
      }

      if (job.entityType !== "person") {
        const id = await upsertTwentyRecord(
          baseUrl,
          apiKey,
          prepared.endpoint,
          "externalId",
          prepared.externalId,
          prepared.fields,
          personId,
          mappedId,
        );
        await ctx.runMutation(internal.twentySync.upsertRecordLink, {
          entityType: job.entityType,
          entityId: job.entityId,
          twentyRecordId: id,
        });
      } else {
        const id = await upsertTwentyRecord(
          baseUrl,
          apiKey,
          prepared.endpoint,
          "avmUserId",
          prepared.externalId,
          prepared.fields,
          undefined,
          mappedId,
        );
        await ctx.runMutation(internal.twentySync.upsertRecordLink, {
          entityType: "person",
          entityId: job.entityId,
          twentyRecordId: id,
        });
      }

      await ctx.runMutation(internal.twentySync.finish, {
        outboxId: args.outboxId,
        revision: job.revision,
        leaseToken: job.leaseToken,
      });
    } catch (error) {
      const httpError = error instanceof TwentyResponseError ? error : null;
      const retryable =
        !httpError ||
        httpError.status === 0 ||
        httpError.status === 408 ||
        httpError.status === 409 ||
        httpError.status === 425 ||
        httpError.status === 429 ||
        httpError.status >= 500;
      await ctx.runMutation(internal.twentySync.fail, {
        outboxId: args.outboxId,
        revision: job.revision,
        leaseToken: job.leaseToken,
        retryable,
        errorCode: httpError?.code ?? "unexpected_delivery_error",
      });
    }
    return null;
  },
});

function endpointFor(entityType: TwentyCrmEntityType): string {
  switch (entityType) {
    case "person":
      return "people";
    case "withdrawal":
      return "avmWithdrawals";
    case "kyc_document":
      return "avmKycDocuments";
    case "risk_hold":
      return "avmRiskHolds";
    case "savings_plan":
      return "avmSavingsPlans";
    case "bank_account":
      return "avmBankAccounts";
    case "transaction":
      return "avmTransactions";
  }
}

export const enqueueRecords = internalMutation({
  args: {
    records: v.array(
      v.object({ entityType: twentyCrmEntityType, entityId: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const record of args.records) {
      await enqueueTwentyCrmRecord(ctx, record.entityType, record.entityId);
    }
    return null;
  },
});

export const listBackfillPage = internalQuery({
  args: {
    entityType: twentyCrmEntityType,
    mode: v.union(v.literal("all"), v.literal("recent"), v.literal("active")),
    status: v.optional(v.string()),
    since: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    ids: v.array(v.string()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    let page: { page: Array<{ _id: string }>; isDone: boolean; continueCursor: string };
    if (args.entityType === "person" || args.entityType === "bank_account") {
      const table = args.entityType === "person" ? "users" : "user_bank_accounts";
      page = await ctx.db.query(table as never).order("asc").paginate(args.paginationOpts) as typeof page;
    } else if (args.entityType === "transaction") {
      page = await ctx.db.query("transactions")
        .withIndex("by_created_at", (q) => q.gte("created_at", args.since))
        .order("asc").paginate(args.paginationOpts) as typeof page;
    } else if (args.entityType === "withdrawal") {
      const query = args.mode === "active"
        ? ctx.db.query("withdrawals").withIndex("by_status_and_requested_at", (q) => q.eq("status", args.status as "pending" | "approved"))
        : ctx.db.query("withdrawals").withIndex("by_requested_at", (q) => q.gte("requested_at", args.since));
      page = await query.order("asc").paginate(args.paginationOpts) as typeof page;
    } else if (args.entityType === "kyc_document") {
      const query = args.mode === "active"
        ? ctx.db.query("kyc_documents").withIndex("by_status_and_created_at", (q) => q.eq("status", args.status as "pending"))
        : ctx.db.query("kyc_documents").withIndex("by_created_at", (q) => q.gte("created_at", args.since));
      page = await query.order("asc").paginate(args.paginationOpts) as typeof page;
    } else if (args.entityType === "risk_hold") {
      const query = args.mode === "active"
        ? ctx.db.query("user_risk_holds").withIndex("by_status", (q) => q.eq("status", "active"))
        : ctx.db.query("user_risk_holds").withIndex("by_placed_at", (q) => q.gte("placed_at", args.since));
      page = await query.order("asc").paginate(args.paginationOpts) as typeof page;
    } else {
      const query = args.mode === "active"
        ? ctx.db.query("user_savings_plans").withIndex("by_status", (q) => q.eq("status", "active"))
        : ctx.db.query("user_savings_plans").withIndex("by_created_at", (q) => q.gte("created_at", args.since));
      page = await query.order("asc").paginate(args.paginationOpts) as typeof page;
    }
    return {
      ids: page.page.map((row) => String(row._id)),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const backfillPage = internalAction({
  args: {
    passIndex: v.number(),
    cursor: v.union(v.string(), v.null()),
    since: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pass = backfillPasses[args.passIndex];
    if (!pass) return null;
    const page = await ctx.runQuery(internal.twentySync.listBackfillPage, {
      entityType: pass.entityType,
      mode: pass.mode,
      status: pass.status,
      since: args.since,
      paginationOpts: { numItems: BACKFILL_PAGE_SIZE, cursor: args.cursor },
    });
    await ctx.runMutation(internal.twentySync.enqueueRecords, {
      records: page.ids.map((entityId) => ({
        entityType: pass.entityType,
        entityId,
      })),
    });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.twentySync.backfillPage, {
        passIndex: args.passIndex,
        cursor: page.continueCursor,
        since: args.since,
      });
    } else if (args.passIndex + 1 < backfillPasses.length) {
      await ctx.scheduler.runAfter(0, internal.twentySync.backfillPage, {
        passIndex: args.passIndex + 1,
        cursor: null,
        since: args.since,
      });
    }
    return null;
  },
});

export const startBackfill = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (![AdminRole.SUPER_ADMIN, AdminRole.ADMIN].includes(admin.role as never)) {
      throw new ConvexError("Not authorized");
    }
    await ctx.scheduler.runAfter(0, internal.twentySync.backfillPage, {
      passIndex: 0,
      cursor: null,
      since: Date.now() - 365 * 24 * 60 * 60_000,
    });
    return null;
  },
});

export const replayFailed = mutation({
  args: { limit: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (![AdminRole.SUPER_ADMIN, AdminRole.ADMIN].includes(admin.role as never)) {
      throw new ConvexError("Not authorized");
    }
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
    const rows = await ctx.db
      .query("twenty_crm_outbox")
      .withIndex("by_status_and_next_attempt_at", (q) => q.eq("status", "failed"))
      .take(limit);
    for (const row of rows) {
      await ctx.db.patch("twenty_crm_outbox", row._id, {
        status: "pending",
        attempt_count: 0,
        next_attempt_at: Date.now(),
        last_error: undefined,
        updated_at: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.twentySync.deliver, {
        outboxId: row._id,
      });
    }
    return rows.length;
  },
});

export const recover = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("twenty_crm_outbox")
      .withIndex("by_status_and_lease_expires_at", (q) =>
        q.eq("status", "processing").lt("lease_expires_at", now),
      )
      .take(100);
    for (const row of expired) {
      await ctx.db.patch("twenty_crm_outbox", row._id, {
        status: "retry",
        lease_token: undefined,
        lease_expires_at: undefined,
        next_attempt_at: now,
        updated_at: now,
      });
      await ctx.scheduler.runAfter(0, internal.twentySync.deliver, {
        outboxId: row._id,
      });
    }
    const due = await ctx.db
      .query("twenty_crm_outbox")
      .withIndex("by_status_and_next_attempt_at", (q) =>
        q.eq("status", "retry").lte("next_attempt_at", now),
      )
      .take(100);
    for (const row of due) {
      await ctx.scheduler.runAfter(0, internal.twentySync.deliver, {
        outboxId: row._id,
      });
    }
    return null;
  },
});

export const queueHealth = query({
  args: {},
  returns: v.object({ failedCount: v.number(), oldestPendingAt: v.union(v.number(), v.null()) }),
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (![AdminRole.SUPER_ADMIN, AdminRole.ADMIN].includes(admin.role as never)) {
      throw new ConvexError("Not authorized");
    }
    const failed = await ctx.db
      .query("twenty_crm_outbox")
      .withIndex("by_status_and_next_attempt_at", (q) => q.eq("status", "failed"))
      .take(1000);
    const pending = await ctx.db
      .query("twenty_crm_outbox")
      .withIndex("by_status_and_created_at", (q) => q.eq("status", "pending"))
      .order("asc")
      .first();
    return {
      failedCount: failed.length,
      oldestPendingAt: pending?.created_at ?? null,
    };
  },
});
