import { type TeamId, teamIdSchema, teams } from "@/server/db/schema";

import { getUserAuth } from "@/lib/auth/utils";
import { db } from "@/server/db/index";
import { eq, and } from "drizzle-orm";

export const getTeams = async () => {
  const { session } = await getUserAuth();

  const t = await db
    .select()
    .from(teams)
    .where(eq(teams.userId, session!.user.id));
  return { teams: t };
};

export const getTeamById = async (id: TeamId) => {
  const { session } = await getUserAuth();
  const { id: teamId } = teamIdSchema.parse({ id });

  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, session!.user.id)));
  return { team };
};
