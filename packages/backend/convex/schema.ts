import { defineSchema } from "convex/server";

import { transaction_reconciliation_issues } from "./schemas/transactionReconciliationIssues";
import { transaction_reconciliation_runs } from "./schemas/transactionReconciliationRuns";
import { bank_account_document_comments } from "./schemas/bankAccountDocumentComments";
import { user_bank_account_events } from "./schemas/userBankAccountEvents";
import { bank_account_documents } from "./schemas/bankAccountDocuments";
import { savings_plan_templates } from "./schemas/savingsPlanTemplates";
import { admin_dashboard_kpis } from "./schemas/adminDashboardKpis";
import { user_bank_accounts } from "./schemas/userBankAccounts";
import { user_savings_plans } from "./schemas/userSavingsPlans";
import { kyc_documents } from "./schemas/kycDocuments";
import { transactions } from "./schemas/transactions";
import { admin_users, users } from "./schemas/users";
import { withdrawals } from "./schemas/withdrawals";
import { TABLE_NAMES } from "./shared";

export default defineSchema({
  [TABLE_NAMES.USERS]: users,
  [TABLE_NAMES.ADMIN_USERS]: admin_users,
  [TABLE_NAMES.WITHDRAWALS]: withdrawals,
  [TABLE_NAMES.TRANSACTIONS]: transactions,
  [TABLE_NAMES.TRANSACTION_RECONCILIATION_RUNS]:
    transaction_reconciliation_runs,
  [TABLE_NAMES.TRANSACTION_RECONCILIATION_ISSUES]:
    transaction_reconciliation_issues,
  [TABLE_NAMES.KYC_DOCUMENTS]: kyc_documents,
  [TABLE_NAMES.USER_SAVINGS_PLANS]: user_savings_plans,
  [TABLE_NAMES.USER_BANK_ACCOUNTS]: user_bank_accounts,
  [TABLE_NAMES.ADMIN_DASHBOARD_KPIS]: admin_dashboard_kpis,
  [TABLE_NAMES.BANK_ACCOUNT_DOCUMENTS]: bank_account_documents,
  [TABLE_NAMES.SAVINGS_PLAN_TEMPLATES]: savings_plan_templates,
  [TABLE_NAMES.USER_BANK_ACCOUNT_EVENTS]: user_bank_account_events,
  [TABLE_NAMES.BANK_ACCOUNT_DOCUMENT_COMMENTS]: bank_account_document_comments,
});
