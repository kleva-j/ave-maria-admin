import { query } from "./_generated/server";
import { authKit } from "./auth";

/**
 * List all users (admin only).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authKit.getAuthUser(ctx);
    if (!user) return null;

    const adminUser = await ctx.db
      .query("admin_users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", user.id))
      .unique();

    if (!adminUser) {
      throw new Error("Not authorized to view users");
    }

    return await ctx.db.query("users").collect();
  },
});
