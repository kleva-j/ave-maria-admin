import type { AuthFunctions } from "@convex-dev/workos-authkit";
import type { DataModel } from "./_generated/dataModel";

import { components, internal } from "./_generated/api";
import { AuthKit } from "@convex-dev/workos-authkit";

const authFunctions: AuthFunctions = internal.auth;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    await ctx.runMutation(internal.users.upsertFromWorkOS, {
      workosId: event.data.id,
      email: event.data.email,
      firstName: event.data.firstName ?? undefined,
      lastName: event.data.lastName ?? undefined,
      profilePictureUrl: event.data.profilePictureUrl ?? undefined,
    });
  },
  "user.updated": async (ctx, event) => {
    await ctx.runMutation(internal.users.upsertFromWorkOS, {
      workosId: event.data.id,
      email: event.data.email,
      firstName: event.data.firstName ?? undefined,
      lastName: event.data.lastName ?? undefined,
      profilePictureUrl: event.data.profilePictureUrl ?? undefined,
    });
  },
  "user.deleted": async (ctx, event) => {
    await ctx.runMutation(internal.users.deleteUser, {
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
    const user = action.user;
    if (user) {
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
      await ctx.runMutation(internal.users.upsertFromWorkOS, {
        workosId: user.id,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        profilePictureUrl: user.profilePictureUrl ?? undefined,
      });
    }
    return response.allow();
  },
});
