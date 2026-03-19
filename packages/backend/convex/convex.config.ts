import { defineApp } from "convex/server";

import workosAuthkit from "@convex-dev/workos-authkit/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config.js";
import auditLog from "convex-audit-log/convex.config";
import crons from "@convex-dev/crons/convex.config";

const app = defineApp();

// Transactions
app.use(aggregate, { name: "transactionAmountByUser" });
app.use(aggregate, { name: "transactionAmountByType" });
app.use(aggregate, { name: "totalTransactionAmount" });
app.use(aggregate, { name: "transactionsByUser" });
app.use(aggregate, { name: "transactionsByType" });
app.use(aggregate, { name: "totalTransactions" });

// Savings Plans
app.use(aggregate, { name: "totalSavingsPlans" });
app.use(aggregate, { name: "savingsPlansByStatus" });
app.use(aggregate, { name: "savingsPlansByUser" });
app.use(aggregate, { name: "savingsPlansByUserAndStatus" });
app.use(aggregate, { name: "totalSavingsAmount" });
app.use(aggregate, { name: "savingsAmountByUser" });
app.use(aggregate, { name: "savingsAmountByStatus" });
app.use(aggregate, { name: "planProgress" });
app.use(aggregate, { name: "savingsAmountByTemplate" });
app.use(aggregate, { name: "savingsPlanAmountByUserAndTemplate" });

// Users
app.use(aggregate, { name: "totalUsers" });
app.use(aggregate, { name: "usersByStatus" });
app.use(aggregate, { name: "usersByOnboardingStatus" });
app.use(aggregate, { name: "totalUserBalance" });
app.use(aggregate, { name: "totalUserSavingsBalance" });

// Reconciliation Issues
app.use(aggregate, { name: "totalReconciliationIssues" });
app.use(aggregate, { name: "reconciliationIssuesByStatus" });
app.use(aggregate, { name: "reconciliationIssuesByType" });
app.use(aggregate, { name: "reconciliationIssuesByRun" });
app.use(aggregate, { name: "reconciliationIssuesByUser" });

// Withdrawals
app.use(aggregate, { name: "totalWithdrawals" });
app.use(aggregate, { name: "withdrawalsByUser" });
app.use(aggregate, { name: "withdrawalsByStatus" });
app.use(aggregate, { name: "withdrawalAmountsByStatus" });

// Auth
app.use(workosAuthkit);

// Audit Log
app.use(auditLog);

// Crons
app.use(crons);

export default app;
