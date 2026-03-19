import { defineApp } from "convex/server";

import workosAuthkit from "@convex-dev/workos-authkit/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config.js";
import auditLog from "convex-audit-log/convex.config";
import crons from "@convex-dev/crons/convex.config";

const app = defineApp();

app.use(aggregate);

app.use(workosAuthkit);
app.use(auditLog);
app.use(crons);

export default app;
