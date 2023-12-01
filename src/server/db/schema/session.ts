import type { z } from "zod";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { text, timestamp, pgEnum } from "drizzle-orm/pg-core";

import { myPgTable } from "./_root";
import { users } from "./user";

export const sessionStatus = ["active", "ended", "removed", "revoked"] as const;
export const sessionStatusEnum = pgEnum("sessionStatus", sessionStatus);

export const sessions = myPgTable("session", {
  id: text("session_id").primaryKey().notNull(),
  expireAt: timestamp("expire_at"),
  clientId: text("client_id").notNull(),
  abandonAt: timestamp("abandon_at"),
  lastAciveAt: timestamp("last_active_at"),
  status: sessionStatusEnum("status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: text("tenant_id")
    .references(() => users.tenantId, { onDelete: "cascade" })
    .default(""),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
export type SessionId = z.infer<typeof sessionIdSchema>["id"];

export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);
export const sessionIdSchema = selectSessionSchema.pick({ id: true });
export const updateSessionSchema = selectSessionSchema;
