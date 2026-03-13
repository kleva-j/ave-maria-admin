import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh dashboard KPIs every 10 minutes.
crons.interval(
  "refresh dashboard kpis",
  { minutes: 10 },
  internal.kpis.refreshDashboardKpis,
  {},
);

export default crons;
