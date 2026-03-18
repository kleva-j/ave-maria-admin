import type { AuthFunctions } from "@convex-dev/workos-authkit";
import type { DataModel } from "./_generated/dataModel";

import { AuthKit } from "@convex-dev/workos-authkit";
import { AuditActions } from "convex-audit-log";

import { components, internal } from "./_generated/api";
import { auditLog } from "./auditLog";

const authFunctions: AuthFunctions = internal.auth;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    await auditLog.log(ctx, {
      action: "workos.user_created",
      severity: "info",
      metadata: { workosId: event.data.id, email: event.data.email },
    });
    await ctx.runMutation(internal.users.upsertFromWorkOS, {
      workosId: event.data.id,
      email: event.data.email,
      firstName: event.data.firstName ?? undefined,
      lastName: event.data.lastName ?? undefined,
      profilePictureUrl: event.data.profilePictureUrl ?? undefined,
      lastLoginAt: event.data.lastSignInAt
        ? Number(new Date(event.data.lastSignInAt))
        : null,
    });
  },
  "user.updated": async (ctx, event) => {
    await auditLog.log(ctx, {
      action: "workos.user_updated",
      severity: "info",
      metadata: { workosId: event.data.id, email: event.data.email },
    });
    await ctx.runMutation(internal.users.upsertFromWorkOS, {
      workosId: event.data.id,
      email: event.data.email,
      firstName: event.data.firstName ?? undefined,
      lastName: event.data.lastName ?? undefined,
      profilePictureUrl: event.data.profilePictureUrl ?? undefined,
      lastLoginAt: event.data.lastSignInAt
        ? Number(new Date(event.data.lastSignInAt))
        : null,
    });
  },

  "user.deleted": async (ctx, event) => {
    await auditLog.log(ctx, {
      action: "workos.user_deleted",
      severity: "warning",
      metadata: { workosId: event.data.id },
    });
    await ctx.runMutation(internal.users.deleteFromWorkOS, {
      workosId: event.data.id,
    });
  },
});

interface WorkOSUserPayload {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}

export const { authKitAction } = authKit.actions({
  authentication: async (ctx, action, response) => {
    // Sync last login time on successful authentication
    const { user } = action;

    if (user) {
      await auditLog.log(ctx, {
        action: AuditActions.USER_LOGIN,
        actorId: user.id,
        severity: "info",
        metadata: { email: user.email },
      });
      await ctx.runMutation(internal.users.upsertFromWorkOS, {
        workosId: user.id,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        profilePictureUrl: user.profilePictureUrl ?? undefined,
        lastLoginAt: Date.now(),
      });
    }
    return response.allow();
  },
  userRegistration: async (ctx, action, response) => {
    // We can also sync user registration data
    const user = (action as { user?: WorkOSUserPayload }).user;
    if (user) {
      await auditLog.log(ctx, {
        action: AuditActions.USER_CREATED,
        actorId: user.id,
        severity: "info",
        metadata: { email: user.email },
      });
      await ctx.runMutation(internal.users.upsertFromWorkOS, {
        workosId: user.id,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        profilePictureUrl: user.profilePictureUrl ?? undefined,
        lastLoginAt: null,
      });
    }
    return response.allow();
  },
});
