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
    // ctx is a mutation context and event.data is typed
  },
  "user.updated": async (ctx, event) => {
    // ctx is a mutation context and event.data is typed
  },
  "user.deleted": async (ctx, event) => {
    // ctx is a mutation context and event.data is typed
  },
});

export const { authKitAction } = authKit.actions({
  authentication: async (_ctx, _action, response) => {
    return response.allow();
  },
  userRegistration: async (_ctx, action, response) => {
    // if (action.userData.email.endsWith("@gmail.com")) {
    //   return response.deny("Gmail accounts are not allowed");
    // }
    return response.allow();
  },
});
