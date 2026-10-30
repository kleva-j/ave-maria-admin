import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "recover Twenty CRM sync jobs",
  { minutes: 1 },
  internal.twentySync.recover,
  {},
);

export default crons;
