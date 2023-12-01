import { createTeam, deleteTeam, updateTeam } from "@/lib/api/teams/mutations";
import { publicProcedure, createTRPCRouter } from "@/server/api/trpc";
import { getTeamById, getTeams } from "@/lib/api/teams/queries";
import {
  updateTeamParams,
  insertTeamParams,
  teamIdSchema,
} from "@/server/db/schema";

export const teamsRouter = createTRPCRouter({
  getTeams: publicProcedure.query(async () => getTeams()),
  getTeamById: publicProcedure
    .input(teamIdSchema)
    .query(async ({ input }) => getTeamById(input.id)),
  createTeam: publicProcedure
    .input(insertTeamParams)
    .mutation(async ({ input }) => createTeam(input)),
  updateTeam: publicProcedure
    .input(updateTeamParams)
    .mutation(async ({ input }) => updateTeam(input.id, input)),
  deleteTeam: publicProcedure
    .input(teamIdSchema)
    .mutation(async ({ input }) => deleteTeam(input.id)),
});
