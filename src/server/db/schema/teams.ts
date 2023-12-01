import type { getTeams } from "@/lib/api/teams/queries";
import type { z } from "zod";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { varchar, text, serial } from "drizzle-orm/pg-core";

import { myPgTable } from "./_root";

export const teams = myPgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: varchar("user_id", { length: 256 }).notNull(),
});

// Schema for teams - used to validate API requests
export const insertTeamSchema = createInsertSchema(teams);
export const insertTeamParams = createSelectSchema(teams, {}).omit({
  id: true,
  userId: true,
});

export const updateTeamSchema = createSelectSchema(teams);
export const updateTeamParams = createSelectSchema(teams, {}).omit({
  userId: true,
});

export const teamIdSchema = updateTeamSchema.pick({ id: true });

// Types for teams - used to type API request params and within Components
export type Team = z.infer<typeof updateTeamSchema>;
export type NewTeam = z.infer<typeof insertTeamSchema>;
export type NewTeamParams = z.infer<typeof insertTeamParams>;
export type UpdateTeamParams = z.infer<typeof updateTeamParams>;
export type TeamId = z.infer<typeof teamIdSchema>["id"];

// this type infers the return from getTeams() - meaning it will include any joins
export type CompleteTeam = Awaited<
  ReturnType<typeof getTeams>
>["teams"][number];
