import { AuditLog } from "convex-audit-log";

import { components } from "./_generated/api";

export const auditLog = new AuditLog(components.auditLog, {
  piiFields: [
    "email",
    "phone",
    "first_name",
    "last_name",
    "referral_code",
  ],
});
