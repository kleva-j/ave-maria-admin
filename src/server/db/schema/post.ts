// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import type { z } from "zod";

import { timestamp, varchar, serial, index, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";

import { myPgTable } from "./_root";
import { users } from "./user";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */

export const posts = myPgTable(
  "post",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow(),
    authorId: text("author_id")
      .references(() => users.tenantId, { onDelete: "cascade" })
      .default(""),
  },
  (table) => ({ nameIndex: index("name_idx").on(table.name) }),
);

// Schema for CRUD - used to validate API requests
export const insertpostSchema = createInsertSchema(posts);
export const selectPostSchema = createSelectSchema(posts);
export const postIdSchema = selectPostSchema.pick({ id: true });
export const updatePostSchema = selectPostSchema;

export type post = typeof posts.$inferSelect;
export type Insertpost = typeof posts.$inferInsert;
export type postId = z.infer<typeof postIdSchema>["id"];
