import { relations } from "drizzle-orm";

import { sessions } from "./session";
import { teams } from "./teams";
import { users } from "./user";
import { posts } from "./post";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  teams: many(teams),
  sessions: many(sessions),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.tenantId],
  }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(users),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.tenantId],
  }),
}));
