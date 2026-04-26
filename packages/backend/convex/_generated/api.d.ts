/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adapters_adminAlertAdapters from "../adapters/adminAlertAdapters.js";
import type * as adapters_auditLogAdapter from "../adapters/auditLogAdapter.js";
import type * as adapters_bankAccountAdapter from "../adapters/bankAccountAdapter.js";
import type * as adapters_eventOutboxAdapter from "../adapters/eventOutboxAdapter.js";
import type * as adapters_kycAdapters from "../adapters/kycAdapters.js";
import type * as adapters_riskAdapters from "../adapters/riskAdapters.js";
import type * as adapters_savingsPlanAdapters from "../adapters/savingsPlanAdapters.js";
import type * as adapters_transactionAdapters from "../adapters/transactionAdapters.js";
import type * as adapters_userAdapters from "../adapters/userAdapters.js";
import type * as adapters_utils from "../adapters/utils.js";
import type * as adapters_withdrawalAdapter from "../adapters/withdrawalAdapter.js";
import type * as adapters_withdrawalPayoutAdapter from "../adapters/withdrawalPayoutAdapter.js";
import type * as adapters_withdrawalReservationAdapter from "../adapters/withdrawalReservationAdapter.js";
import type * as admin from "../admin.js";
import type * as adminAlertPolicies from "../adminAlertPolicies.js";
import type * as adminAlerts from "../adminAlerts.js";
import type * as adminUserPolicy from "../adminUserPolicy.js";
import type * as aggregateHelpers from "../aggregateHelpers.js";
import type * as aggregates from "../aggregates.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as bankAccountDocumentComments from "../bankAccountDocumentComments.js";
import type * as bankAccountDocuments from "../bankAccountDocuments.js";
import type * as bankAccounts from "../bankAccounts.js";
import type * as debugAuth from "../debugAuth.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as kpis from "../kpis.js";
import type * as kyc from "../kyc.js";
import type * as kycDocuments from "../kycDocuments.js";
import type * as kycInternal from "../kycInternal.js";
import type * as risk from "../risk.js";
import type * as savingsPlanRules from "../savingsPlanRules.js";
import type * as savingsPlanTemplates from "../savingsPlanTemplates.js";
import type * as savingsPlans from "../savingsPlans.js";
import type * as schemas_adminAlertReceipts from "../schemas/adminAlertReceipts.js";
import type * as schemas_adminAlerts from "../schemas/adminAlerts.js";
import type * as schemas_adminDashboardKpis from "../schemas/adminDashboardKpis.js";
import type * as schemas_bankAccountDocumentComments from "../schemas/bankAccountDocumentComments.js";
import type * as schemas_bankAccountDocuments from "../schemas/bankAccountDocuments.js";
import type * as schemas_documentReviewNotifications from "../schemas/documentReviewNotifications.js";
import type * as schemas_kycDocuments from "../schemas/kycDocuments.js";
import type * as schemas_notificationEvents from "../schemas/notificationEvents.js";
import type * as schemas_riskEvents from "../schemas/riskEvents.js";
import type * as schemas_savingsPlanTemplates from "../schemas/savingsPlanTemplates.js";
import type * as schemas_transactionReconciliationIssues from "../schemas/transactionReconciliationIssues.js";
import type * as schemas_transactionReconciliationRuns from "../schemas/transactionReconciliationRuns.js";
import type * as schemas_transactions from "../schemas/transactions.js";
import type * as schemas_userBankAccountEvents from "../schemas/userBankAccountEvents.js";
import type * as schemas_userBankAccounts from "../schemas/userBankAccounts.js";
import type * as schemas_userRiskHolds from "../schemas/userRiskHolds.js";
import type * as schemas_userSavingsPlans from "../schemas/userSavingsPlans.js";
import type * as schemas_users from "../schemas/users.js";
import type * as schemas_withdrawalReservations from "../schemas/withdrawalReservations.js";
import type * as schemas_withdrawals from "../schemas/withdrawals.js";
import type * as shared from "../shared.js";
import type * as transactions from "../transactions.js";
import type * as types from "../types.js";
import type * as userAudit from "../userAudit.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as verificationQueue from "../verificationQueue.js";
import type * as withdrawalPolicy from "../withdrawalPolicy.js";
import type * as withdrawals from "../withdrawals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "adapters/adminAlertAdapters": typeof adapters_adminAlertAdapters;
  "adapters/auditLogAdapter": typeof adapters_auditLogAdapter;
  "adapters/bankAccountAdapter": typeof adapters_bankAccountAdapter;
  "adapters/eventOutboxAdapter": typeof adapters_eventOutboxAdapter;
  "adapters/kycAdapters": typeof adapters_kycAdapters;
  "adapters/riskAdapters": typeof adapters_riskAdapters;
  "adapters/savingsPlanAdapters": typeof adapters_savingsPlanAdapters;
  "adapters/transactionAdapters": typeof adapters_transactionAdapters;
  "adapters/userAdapters": typeof adapters_userAdapters;
  "adapters/utils": typeof adapters_utils;
  "adapters/withdrawalAdapter": typeof adapters_withdrawalAdapter;
  "adapters/withdrawalPayoutAdapter": typeof adapters_withdrawalPayoutAdapter;
  "adapters/withdrawalReservationAdapter": typeof adapters_withdrawalReservationAdapter;
  admin: typeof admin;
  adminAlertPolicies: typeof adminAlertPolicies;
  adminAlerts: typeof adminAlerts;
  adminUserPolicy: typeof adminUserPolicy;
  aggregateHelpers: typeof aggregateHelpers;
  aggregates: typeof aggregates;
  auditLog: typeof auditLog;
  auth: typeof auth;
  bankAccountDocumentComments: typeof bankAccountDocumentComments;
  bankAccountDocuments: typeof bankAccountDocuments;
  bankAccounts: typeof bankAccounts;
  debugAuth: typeof debugAuth;
  healthCheck: typeof healthCheck;
  http: typeof http;
  init: typeof init;
  kpis: typeof kpis;
  kyc: typeof kyc;
  kycDocuments: typeof kycDocuments;
  kycInternal: typeof kycInternal;
  risk: typeof risk;
  savingsPlanRules: typeof savingsPlanRules;
  savingsPlanTemplates: typeof savingsPlanTemplates;
  savingsPlans: typeof savingsPlans;
  "schemas/adminAlertReceipts": typeof schemas_adminAlertReceipts;
  "schemas/adminAlerts": typeof schemas_adminAlerts;
  "schemas/adminDashboardKpis": typeof schemas_adminDashboardKpis;
  "schemas/bankAccountDocumentComments": typeof schemas_bankAccountDocumentComments;
  "schemas/bankAccountDocuments": typeof schemas_bankAccountDocuments;
  "schemas/documentReviewNotifications": typeof schemas_documentReviewNotifications;
  "schemas/kycDocuments": typeof schemas_kycDocuments;
  "schemas/notificationEvents": typeof schemas_notificationEvents;
  "schemas/riskEvents": typeof schemas_riskEvents;
  "schemas/savingsPlanTemplates": typeof schemas_savingsPlanTemplates;
  "schemas/transactionReconciliationIssues": typeof schemas_transactionReconciliationIssues;
  "schemas/transactionReconciliationRuns": typeof schemas_transactionReconciliationRuns;
  "schemas/transactions": typeof schemas_transactions;
  "schemas/userBankAccountEvents": typeof schemas_userBankAccountEvents;
  "schemas/userBankAccounts": typeof schemas_userBankAccounts;
  "schemas/userRiskHolds": typeof schemas_userRiskHolds;
  "schemas/userSavingsPlans": typeof schemas_userSavingsPlans;
  "schemas/users": typeof schemas_users;
  "schemas/withdrawalReservations": typeof schemas_withdrawalReservations;
  "schemas/withdrawals": typeof schemas_withdrawals;
  shared: typeof shared;
  transactions: typeof transactions;
  types: typeof types;
  userAudit: typeof userAudit;
  users: typeof users;
  utils: typeof utils;
  verificationQueue: typeof verificationQueue;
  withdrawalPolicy: typeof withdrawalPolicy;
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
  transactionAmountByUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"transactionAmountByUser">;
  transactionAmountByType: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"transactionAmountByType">;
  totalTransactionAmount: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalTransactionAmount">;
  transactionsByUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"transactionsByUser">;
  transactionsByType: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"transactionsByType">;
  totalTransactions: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalTransactions">;
  totalSavingsPlans: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalSavingsPlans">;
  savingsPlansByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"savingsPlansByStatus">;
  savingsPlansByUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"savingsPlansByUser">;
  savingsPlansByUserAndStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"savingsPlansByUserAndStatus">;
  totalSavingsAmount: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalSavingsAmount">;
  savingsAmountByUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"savingsAmountByUser">;
  savingsAmountByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"savingsAmountByStatus">;
  planProgress: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"planProgress">;
  savingsAmountByTemplate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"savingsAmountByTemplate">;
  savingsPlanAmountByUserAndTemplate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"savingsPlanAmountByUserAndTemplate">;
  totalUsers: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalUsers">;
  usersByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"usersByStatus">;
  usersByOnboardingStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"usersByOnboardingStatus">;
  totalUserBalance: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalUserBalance">;
  totalUserSavingsBalance: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalUserSavingsBalance">;
  totalReconciliationIssues: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalReconciliationIssues">;
  reconciliationIssuesByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"reconciliationIssuesByStatus">;
  reconciliationIssuesByType: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"reconciliationIssuesByType">;
  reconciliationIssuesByRun: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"reconciliationIssuesByRun">;
  reconciliationIssuesByUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"reconciliationIssuesByUser">;
  totalWithdrawals: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"totalWithdrawals">;
  withdrawalsByUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"withdrawalsByUser">;
  withdrawalsByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"withdrawalsByStatus">;
  withdrawalAmountsByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"withdrawalAmountsByStatus">;
  workOSAuthKit: import("@convex-dev/workos-authkit/_generated/component.js").ComponentApi<"workOSAuthKit">;
  auditLog: import("convex-audit-log/_generated/component.js").ComponentApi<"auditLog">;
  crons: import("@convex-dev/crons/_generated/component.js").ComponentApi<"crons">;
};
