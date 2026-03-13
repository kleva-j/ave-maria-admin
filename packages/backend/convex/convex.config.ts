import { defineApp } from "convex/server";

import workosAuthkit from "@convex-dev/workos-authkit/convex.config";
import auditLog from "convex-audit-log/convex.config";
import crons from "@convex-dev/crons/convex.config";

const app = defineApp();

app.use(workosAuthkit);
app.use(auditLog);
app.use(crons);

export default app;
