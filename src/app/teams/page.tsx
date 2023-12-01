import TeamList from "@/components/teams/TeamList";
import NewTeamModal from "@/components/teams/TeamModal";
import { getTeams } from "@/lib/api/teams/queries";
import { checkAuth } from "@/lib/auth/utils";

export default async function Teams() {
  await checkAuth();
  const { teams } = await getTeams();  

  return (
    <main className="max-w-3xl mx-auto p-5 md:p-0 sm:pt-4">
      <div className="flex justify-between">
        <h1 className="font-semibold text-2xl my-2">Teams</h1>
        <NewTeamModal />
      </div>
      <TeamList teams={teams} />
    </main>
  );
}
