import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

import { ConvexError } from "convex/values";

export async function ensureUser(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }
}
