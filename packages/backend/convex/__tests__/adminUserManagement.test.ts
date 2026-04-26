import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";

import {
  assertDeactivationAllowed,
  assertRoleChangeAllowed,
} from "../adminUserPolicy";
import { AdminRole, UserStatus } from "../shared";

const VIEWER = {
  _id: "viewer_id",
  role: AdminRole.SUPER_ADMIN,
  status: UserStatus.ACTIVE,
};

function makeAdmin(
  overrides: Partial<{
    _id: string;
    role: AdminRole;
    status: UserStatus;
    deleted_at?: number;
  }>,
) {
  return {
    _id: "target_id",
    role: AdminRole.OPERATIONS,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

describe("assertRoleChangeAllowed", () => {
  it("is a no-op when the role is unchanged", () => {
    const target = makeAdmin({ role: AdminRole.OPERATIONS });
    expect(() =>
      assertRoleChangeAllowed({
        viewer: VIEWER,
        target,
        newRole: AdminRole.OPERATIONS,
        activeSuperAdminCount: 5,
      }),
    ).not.toThrow();
  });

  it("allows a normal role swap", () => {
    const target = makeAdmin({ role: AdminRole.OPERATIONS });
    expect(() =>
      assertRoleChangeAllowed({
        viewer: VIEWER,
        target,
        newRole: AdminRole.FINANCE,
        activeSuperAdminCount: 3,
      }),
    ).not.toThrow();
  });

  it("rejects a viewer demoting themselves from super_admin", () => {
    const self = {
      _id: VIEWER._id,
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    };
    expect(() =>
      assertRoleChangeAllowed({
        viewer: VIEWER,
        target: self,
        newRole: AdminRole.OPERATIONS,
        activeSuperAdminCount: 5,
      }),
    ).toThrowError(ConvexError);
  });

  it("rejects demoting the last active super_admin", () => {
    const target = makeAdmin({
      _id: "other_super_admin",
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });
    expect(() =>
      assertRoleChangeAllowed({
        viewer: VIEWER,
        target,
        newRole: AdminRole.OPERATIONS,
        activeSuperAdminCount: 1,
      }),
    ).toThrowError(ConvexError);
  });

  it("allows demoting a super_admin when more than one active super_admin exists", () => {
    const target = makeAdmin({
      _id: "other_super_admin",
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });
    expect(() =>
      assertRoleChangeAllowed({
        viewer: VIEWER,
        target,
        newRole: AdminRole.OPERATIONS,
        activeSuperAdminCount: 2,
      }),
    ).not.toThrow();
  });

  it("allows demoting a suspended super_admin even when count is 1", () => {
    // A suspended super_admin does not count toward active coverage,
    // so demoting them is safe regardless of activeSuperAdminCount.
    const target = makeAdmin({
      _id: "suspended_super_admin",
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.SUSPENDED,
    });
    expect(() =>
      assertRoleChangeAllowed({
        viewer: VIEWER,
        target,
        newRole: AdminRole.OPERATIONS,
        activeSuperAdminCount: 1,
      }),
    ).not.toThrow();
  });
});

describe("assertDeactivationAllowed", () => {
  it("rejects deactivating self", () => {
    const self = { ...VIEWER };
    expect(() =>
      assertDeactivationAllowed({
        viewer: VIEWER,
        target: self,
        activeSuperAdminCount: 5,
      }),
    ).toThrowError(ConvexError);
  });

  it("rejects deactivating an already-deactivated admin", () => {
    const target = makeAdmin({ deleted_at: 1700000000000 });
    expect(() =>
      assertDeactivationAllowed({
        viewer: VIEWER,
        target,
        activeSuperAdminCount: 5,
      }),
    ).toThrowError(ConvexError);
  });

  it("rejects deactivating the last active super_admin", () => {
    const target = makeAdmin({
      _id: "other_super_admin",
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });
    expect(() =>
      assertDeactivationAllowed({
        viewer: VIEWER,
        target,
        activeSuperAdminCount: 1,
      }),
    ).toThrowError(ConvexError);
  });

  it("allows deactivating a super_admin when more than one active exists", () => {
    const target = makeAdmin({
      _id: "other_super_admin",
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });
    expect(() =>
      assertDeactivationAllowed({
        viewer: VIEWER,
        target,
        activeSuperAdminCount: 3,
      }),
    ).not.toThrow();
  });

  it("allows deactivating a non-super-admin", () => {
    const target = makeAdmin({
      role: AdminRole.OPERATIONS,
      status: UserStatus.ACTIVE,
    });
    expect(() =>
      assertDeactivationAllowed({
        viewer: VIEWER,
        target,
        activeSuperAdminCount: 1,
      }),
    ).not.toThrow();
  });
});
