import { query } from "./_generated/server";
import { v } from "convex/values";

import { authKit } from "./auth";
import { TABLE_NAMES } from "./shared";

/**
 * Diagnostic-only query.
 *
 * Call from a signed-in browser (e.g. via the React Query devtools or a
 * scratch component) to pinpoint why `Not authenticated` is being thrown.
 *
 * Returns one of three states:
 *   - { stage: "no_jwt" } → Convex did not receive a JWT. Fix the web client
 *     (ConvexProviderWithAuth wiring, useAuth adapter, AuthKit access token).
 *   - { stage: "jwt_no_component_user" } → JWT reached Convex but the
 *     `@convex-dev/workos-authkit` component has no row for this user. The
 *     `user.created` webhook never fired against `${convexUrl}/workos/webhook`.
 *     Configure the webhook in the WorkOS dashboard.
 *   - { stage: "jwt_no_app_user" } → component has a row, but the app's
 *     `users` table does not. The app-level `authKitEvent` handler did not
 *     run (component vs app webhook subscription mismatch).
 *   - { stage: "ok", ... } → fully authenticated.
 *
 * REMOVE this file once root cause is fixed.
 */
export const debugAuth = query({
  args: {},
  returns: v.object({
    stage: v.string(),
    workosId: v.optional(v.string()),
    jwtIssuer: v.optional(v.string()),
    jwtSubject: v.optional(v.string()),
    componentUserPresent: v.optional(v.boolean()),
    appUserPresent: v.optional(v.boolean()),
    appAdminPresent: v.optional(v.boolean()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { stage: "no_jwt" };
    }

    const componentUser = await authKit.getAuthUser(ctx);
    if (!componentUser) {
      return {
        stage: "jwt_no_component_user",
        jwtIssuer: identity.issuer ?? undefined,
        jwtSubject: identity.subject ?? undefined,
      };
    }

    const appUser = await ctx.db
      .query(TABLE_NAMES.USERS)
      .withIndex("by_workos_id", (q) => q.eq("workosId", componentUser.id))
      .unique();

    const appAdmin = await ctx.db
      .query(TABLE_NAMES.ADMIN_USERS)
      .withIndex("by_workos_id", (q) => q.eq("workosId", componentUser.id))
      .unique();

    if (!appUser && !appAdmin) {
      return {
        stage: "jwt_no_app_user",
        workosId: componentUser.id,
        jwtIssuer: identity.issuer ?? undefined,
        jwtSubject: identity.subject ?? undefined,
        componentUserPresent: true,
      };
    }

    return {
      stage: "ok",
      workosId: componentUser.id,
      jwtIssuer: identity.issuer ?? undefined,
      jwtSubject: identity.subject ?? undefined,
      componentUserPresent: true,
      appUserPresent: !!appUser,
      appAdminPresent: !!appAdmin,
    };
  },
});
