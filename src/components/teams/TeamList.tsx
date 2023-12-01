"use client";

import type { CompleteTeam } from "@/server/db/schema/teams";

import { api as trpc } from "@/trpc/react";

import TeamModal from "./TeamModal";

export default function TeamList({ teams }: { teams: CompleteTeam[] }) {
  const { data: t } = trpc.teams.getTeams.useQuery(undefined, {
    initialData: { teams },
    refetchOnMount: false,
  });

  if (t.teams.length === 0) return <EmptyState />;

  return (
    <ul>
      {t.teams.map((team) => (
        <Team team={team} key={team.id} />
      ))}
    </ul>
  );
}

const Team = ({ team }: { team: CompleteTeam }) => {
  return (
    <li className="my-2 flex justify-between">
      <div className="w-full">
        <div>{team.name}</div>
      </div>
      <TeamModal team={team} />
    </li>
  );
};

const EmptyState = () => {
  return (
    <div className="text-center">
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No teams</h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by creating a new team.
      </p>
      <div className="mt-6">
        <TeamModal emptyState={true} />
      </div>
    </div>
  );
};
