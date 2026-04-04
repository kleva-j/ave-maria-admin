import { describe, expect, it } from "vitest";

import { buildUserProfileSyncAuditChange } from "../userAudit";

describe("buildUserProfileSyncAuditChange", () => {
  it("tracks changed profile fields without retaining raw PII values", () => {
    const auditChange = buildUserProfileSyncAuditChange(
      {
        email: "old@example.com",
        first_name: "Ada",
        last_name: "Lovelace",
      },
      {
        email: "new@example.com",
        first_name: "Ada",
        last_name: "Byron",
      },
    );

    expect(auditChange.changedFields).toEqual(["email", "last_name"]);
    expect(auditChange.before).toEqual({
      email_present: true,
      first_name_present: true,
      last_name_present: true,
    });
    expect(auditChange.after).toEqual({
      email_present: true,
      first_name_present: true,
      last_name_present: true,
      changed_fields: ["email", "last_name"],
    });

    expect(JSON.stringify(auditChange)).not.toContain("old@example.com");
    expect(JSON.stringify(auditChange)).not.toContain("new@example.com");
    expect(JSON.stringify(auditChange)).not.toContain("Lovelace");
    expect(JSON.stringify(auditChange)).not.toContain("Byron");
  });
});
