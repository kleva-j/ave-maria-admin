import { describe, expect, it } from "vitest";

import { isAdminRole } from "@/lib/admin-auth";

describe("isAdminRole", () => {
  it("recognizes supported admin roles", () => {
    expect(isAdminRole("finance", null, null)).toBe(true);
    expect(isAdminRole(null, ["support"], null)).toBe(true);
  });

  it("recognizes admin permission fallback", () => {
    expect(isAdminRole(undefined, [], ["admin"])).toBe(true);
  });

  it("returns false for non-admin roles", () => {
    expect(isAdminRole("member", ["user"], ["read:profile"])).toBe(false);
  });
});
