import {
  type UpdateTeamParams,
  type NewTeamParams,
  type TeamId,
  updateTeamSchema,
  insertTeamSchema,
  teamIdSchema,
  teams,
} from "@/server/db/schema/teams";

import { getUserAuth } from "@/lib/auth/utils";
import { db } from "@/server/db/index";
import { and, eq } from "drizzle-orm";

export const createTeam = async (team: NewTeamParams) => {
  const { session } = await getUserAuth();

  const userId = session!.user.id;

  const newTeam = insertTeamSchema.parse({ ...team, userId });

  try {
    const [team] = await db.insert(teams).values(newTeam).returning();
    return { team };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);

    return { error: message };
  }
};

export const updateTeam = async (id: TeamId, team: UpdateTeamParams) => {
  const { session } = await getUserAuth();

  const userId = session!.user.id;

  const { id: teamId } = teamIdSchema.parse({ id });
  const newTeam = updateTeamSchema.parse({ ...team, userId });

  try {
    const [team] = await db
      .update(teams)
      .set(newTeam)
      .where(and(eq(teams.id, teamId), eq(teams.userId, session!.user.id)))
      .returning();

    return { team };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);

    return { error: message };
  }
};

export const deleteTeam = async (id: TeamId) => {
  const { session } = await getUserAuth();

  const { id: teamId } = teamIdSchema.parse({ id });

  try {
    const [team] = await db
      .delete(teams)
      .where(and(eq(teams.id, teamId), eq(teams.userId, session!.user.id)))
      .returning();

    return { team };
  } catch (err) {
    const message = (err as Error).message ?? "Error, please try again";
    console.error(message);

    return { error: message };
  }
};
