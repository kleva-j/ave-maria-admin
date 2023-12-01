import type { z } from "zod";

import { uniqueIndex, timestamp, varchar, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createId } from "@paralleldrive/cuid2";

import { myPgTable } from "./_root";

export const users = myPgTable(
  "user",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    firstName: text("first_name").default(""),
    lastName: text("last_name").default(""),
    imageUrl: text("image_url").default(""),
    email: text("email").default("").unique(),
    tenantId: varchar("tenant_id", { length: 50 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIndex: uniqueIndex("email_idx").on(table.email),
    tenantIdIndex: uniqueIndex("tenant_id_idx").on(table.tenantId),
  }),
);

// Schema for CRUD - used to validate API requests
export const insertUserSchema = createInsertSchema(users);
export const insertUserParams = createSelectSchema(users, {}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectUserSchema = createSelectSchema(users);
export const updateUserParams = createSelectSchema(users, {}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tenantId: true,
});
export const userIdSchema = selectUserSchema.pick({ id: true });
export const updateUserSchema = selectUserSchema;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type NewUserParams = z.infer<typeof insertUserParams>;
export type UpdateUserParams = z.infer<typeof updateUserParams>;
export type UserId = z.infer<typeof userIdSchema>["id"];
