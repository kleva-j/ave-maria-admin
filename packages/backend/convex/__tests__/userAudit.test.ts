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
    const serializedAuditChange = JSON.stringify(auditChange);

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

    expect(serializedAuditChange).not.toContain("old@example.com");
    expect(serializedAuditChange).not.toContain("new@example.com");
    expect(serializedAuditChange).not.toContain("Ada");
    expect(serializedAuditChange).not.toContain("Lovelace");
    expect(serializedAuditChange).not.toContain("Byron");
  });

  it("treats undefined, null, and empty strings as the same absent profile value", () => {
    const auditChange = buildUserProfileSyncAuditChange(
      {
        email: undefined,
        first_name: "",
        last_name: null,
      },
      {
        email: null,
        first_name: undefined,
        last_name: "",
      },
    );

    expect(auditChange.changedFields).toEqual([]);
    expect(auditChange.before).toEqual({
      email_present: false,
      first_name_present: false,
      last_name_present: false,
    });
    expect(auditChange.after).toEqual({
      email_present: false,
      first_name_present: false,
      last_name_present: false,
      changed_fields: [],
    });
  });
});
