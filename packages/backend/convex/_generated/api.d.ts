/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as bankAccountDocuments from "../bankAccountDocuments.js";
import type * as bankAccounts from "../bankAccounts.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as kpis from "../kpis.js";
import type * as kyc from "../kyc.js";
import type * as kycDocuments from "../kycDocuments.js";
import type * as schemas_adminDashboardKpis from "../schemas/adminDashboardKpis.js";
import type * as schemas_bankAccountDocuments from "../schemas/bankAccountDocuments.js";
import type * as schemas_kycDocuments from "../schemas/kycDocuments.js";
import type * as schemas_savingsPlanTemplates from "../schemas/savingsPlanTemplates.js";
import type * as schemas_transactionReconciliationIssues from "../schemas/transactionReconciliationIssues.js";
import type * as schemas_transactionReconciliationRuns from "../schemas/transactionReconciliationRuns.js";
import type * as schemas_transactions from "../schemas/transactions.js";
import type * as schemas_userBankAccountEvents from "../schemas/userBankAccountEvents.js";
import type * as schemas_userBankAccounts from "../schemas/userBankAccounts.js";
import type * as schemas_userSavingsPlans from "../schemas/userSavingsPlans.js";
import type * as schemas_users from "../schemas/users.js";
import type * as schemas_withdrawals from "../schemas/withdrawals.js";
import type * as shared from "../shared.js";
import type * as transactions from "../transactions.js";
import type * as types from "../types.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as verificationQueue from "../verificationQueue.js";
import type * as withdrawals from "../withdrawals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auditLog: typeof auditLog;
  auth: typeof auth;
  bankAccountDocuments: typeof bankAccountDocuments;
  bankAccounts: typeof bankAccounts;
  healthCheck: typeof healthCheck;
  http: typeof http;
  init: typeof init;
  kpis: typeof kpis;
  kyc: typeof kyc;
  kycDocuments: typeof kycDocuments;
  "schemas/adminDashboardKpis": typeof schemas_adminDashboardKpis;
  "schemas/bankAccountDocuments": typeof schemas_bankAccountDocuments;
  "schemas/kycDocuments": typeof schemas_kycDocuments;
  "schemas/savingsPlanTemplates": typeof schemas_savingsPlanTemplates;
  "schemas/transactionReconciliationIssues": typeof schemas_transactionReconciliationIssues;
  "schemas/transactionReconciliationRuns": typeof schemas_transactionReconciliationRuns;
  "schemas/transactions": typeof schemas_transactions;
  "schemas/userBankAccountEvents": typeof schemas_userBankAccountEvents;
  "schemas/userBankAccounts": typeof schemas_userBankAccounts;
  "schemas/userSavingsPlans": typeof schemas_userSavingsPlans;
  "schemas/users": typeof schemas_users;
  "schemas/withdrawals": typeof schemas_withdrawals;
  shared: typeof shared;
  transactions: typeof transactions;
  types: typeof types;
  users: typeof users;
  utils: typeof utils;
  verificationQueue: typeof verificationQueue;
  withdrawals: typeof withdrawals;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workOSAuthKit: {
    lib: {
      enqueueWebhookEvent: FunctionReference<
        "mutation",
        "internal",
        {
          apiKey: string;
          event: string;
          eventId: string;
          eventTypes?: Array<string>;
          logLevel?: "DEBUG";
          onEventHandle?: string;
          updatedAt?: string;
        },
        any
      >;
      getAuthUser: FunctionReference<
        "query",
        "internal",
        { id: string },
        {
          createdAt: string;
          email: string;
          emailVerified: boolean;
          externalId?: null | string;
          firstName?: null | string;
          id: string;
          lastName?: null | string;
          lastSignInAt?: null | string;
          locale?: null | string;
          metadata: Record<string, any>;
          profilePictureUrl?: null | string;
          updatedAt: string;
        } | null
      >;
    };
  };
  auditLog: {
    lib: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          olderThanDays?: number;
          preserveSeverity?: Array<"info" | "warning" | "error" | "critical">;
          retentionCategory?: string;
        },
        number
      >;
      detectAnomalies: FunctionReference<
        "query",
        "internal",
        {
          patterns: Array<{
            action: string;
            threshold: number;
            windowMinutes: number;
          }>;
        },
        Array<{
          action: string;
          count: number;
          detectedAt: number;
          threshold: number;
          windowMinutes: number;
        }>
      >;
      generateReport: FunctionReference<
        "query",
        "internal",
        {
          endDate: number;
          format: "json" | "csv";
          groupBy?: string;
          includeFields?: Array<string>;
          maxRecords?: number;
          startDate: number;
        },
        {
          data: string;
          format: "json" | "csv";
          generatedAt: number;
          recordCount: number;
          truncated: boolean;
        }
      >;
      get: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | {
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }
      >;
      getConfig: FunctionReference<
        "query",
        "internal",
        {},
        null | {
          _creationTime: number;
          _id: string;
          criticalRetentionDays: number;
          customRetention?: Array<{ category: string; retentionDays: number }>;
          defaultRetentionDays: number;
          piiFieldsToRedact: Array<string>;
          samplingEnabled: boolean;
          samplingRate: number;
        }
      >;
      getStats: FunctionReference<
        "query",
        "internal",
        { fromTimestamp?: number; toTimestamp?: number },
        {
          bySeverity: {
            critical: number;
            error: number;
            info: number;
            warning: number;
          };
          topActions: Array<{ action: string; count: number }>;
          topActors: Array<{ actorId: string; count: number }>;
          totalCount: number;
        }
      >;
      log: FunctionReference<
        "mutation",
        "internal",
        {
          action: string;
          actorId?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          userAgent?: string;
        },
        string
      >;
      logBulk: FunctionReference<
        "mutation",
        "internal",
        {
          events: Array<{
            action: string;
            actorId?: string;
            ipAddress?: string;
            metadata?: any;
            resourceId?: string;
            resourceType?: string;
            retentionCategory?: string;
            sessionId?: string;
            severity: "info" | "warning" | "error" | "critical";
            tags?: Array<string>;
            userAgent?: string;
          }>;
        },
        Array<string>
      >;
      logChange: FunctionReference<
        "mutation",
        "internal",
        {
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          generateDiff?: boolean;
          ipAddress?: string;
          resourceId: string;
          resourceType: string;
          retentionCategory?: string;
          sessionId?: string;
          severity?: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          userAgent?: string;
        },
        string
      >;
      queryByAction: FunctionReference<
        "query",
        "internal",
        { action: string; fromTimestamp?: number; limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>
      >;
      queryByActor: FunctionReference<
        "query",
        "internal",
        {
          actions?: Array<string>;
          actorId: string;
          fromTimestamp?: number;
          limit?: number;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>
      >;
      queryByResource: FunctionReference<
        "query",
        "internal",
        {
          fromTimestamp?: number;
          limit?: number;
          resourceId: string;
          resourceType: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>
      >;
      queryBySeverity: FunctionReference<
        "query",
        "internal",
        {
          fromTimestamp?: number;
          limit?: number;
          severity: Array<"info" | "warning" | "error" | "critical">;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>
      >;
      runBackfill: FunctionReference<
        "mutation",
        "internal",
        { batchSize?: number; cursor?: string },
        { cursor: string | null; isDone: boolean; processed: number }
      >;
      search: FunctionReference<
        "query",
        "internal",
        {
          filters: {
            actions?: Array<string>;
            actorIds?: Array<string>;
            fromTimestamp?: number;
            resourceTypes?: Array<string>;
            severity?: Array<"info" | "warning" | "error" | "critical">;
            tags?: Array<string>;
            toTimestamp?: number;
          };
          pagination: { cursor?: string; limit: number };
        },
        {
          cursor: string | null;
          hasMore: boolean;
          items: Array<{
            _creationTime: number;
            _id: string;
            action: string;
            actorId?: string;
            after?: any;
            before?: any;
            diff?: string;
            ipAddress?: string;
            metadata?: any;
            resourceId?: string;
            resourceType?: string;
            retentionCategory?: string;
            sessionId?: string;
            severity: "info" | "warning" | "error" | "critical";
            tags?: Array<string>;
            timestamp: number;
            userAgent?: string;
          }>;
        }
      >;
      updateConfig: FunctionReference<
        "mutation",
        "internal",
        {
          criticalRetentionDays?: number;
          customRetention?: Array<{ category: string; retentionDays: number }>;
          defaultRetentionDays?: number;
          piiFieldsToRedact?: Array<string>;
          samplingEnabled?: boolean;
          samplingRate?: number;
        },
        string
      >;
      watchCritical: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          severity?: Array<"info" | "warning" | "error" | "critical">;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>
      >;
    };
  };
  crons: {
    public: {
      del: FunctionReference<
        "mutation",
        "internal",
        { identifier: { id: string } | { name: string } },
        null
      >;
      get: FunctionReference<
        "query",
        "internal",
        { identifier: { id: string } | { name: string } },
        {
          args: Record<string, any>;
          functionHandle: string;
          id: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        } | null
      >;
      list: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          args: Record<string, any>;
          functionHandle: string;
          id: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        }>
      >;
      register: FunctionReference<
        "mutation",
        "internal",
        {
          args: Record<string, any>;
          functionHandle: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        },
        string
      >;
    };
  };
};
