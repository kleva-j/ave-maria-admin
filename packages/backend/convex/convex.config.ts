import { defineApp } from "convex/server";

import workosAuthkit from "@convex-dev/workos-authkit/convex.config";

const app = defineApp();

app.use(workosAuthkit);

export default app;
