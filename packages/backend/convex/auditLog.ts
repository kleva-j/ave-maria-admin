import type { AuthContext } from "./types";

import { exposeAuditLogApi, AuditLog } from "convex-audit-log";

import { components } from "./_generated/api";
import { TABLE_NAMES } from "./shared";
import { authKit } from "./auth";

export const auditLog = new AuditLog(components.auditLog, {
  piiFields: [
    "email",
    "phone",
    "first_name",
    "last_name",
    "referral_code",
    "account_number",
  ],
});

export const {
  watchCritical,
  queryByResource,
  queryByActor,
  getStats,
  cleanup,
} = exposeAuditLogApi(components.auditLog, {
  auth: async (ctx, { type }) => {
    const authUser = await authKit.getAuthUser(ctx as AuthContext);

    if (!authUser) throw new Error("Not Authenticated");

    const user = await (ctx as AuthContext).db
      .query(type === "admin" ? TABLE_NAMES.ADMIN_USERS : TABLE_NAMES.USERS)
      .withIndex("by_workos_id", (q) => q.eq("workosId", authUser.id))
      .unique();

    if (!user) throw new Error("User not found");

    return user._id;
  },
});
