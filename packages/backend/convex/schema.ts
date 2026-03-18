import { defineSchema } from "convex/server";

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

export default defineSchema({
  users,
  admin_users,
  withdrawals,
  transactions,
  kyc_documents,
  user_savings_plans,
  user_bank_accounts,
  admin_dashboard_kpis,
  bank_account_documents,
  savings_plan_templates,
  user_bank_account_events,
});
