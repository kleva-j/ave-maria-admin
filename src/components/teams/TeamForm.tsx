"use client";

import type { Team, NewTeamParams } from "@/server/db/schema";

import { insertTeamParams } from "@/server/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { api as trpc } from "@/trpc/react";
import { useForm } from "react-hook-form";

import {
  FormControl,
  FormMessage,
  FormLabel,
  FormField,
  FormItem,
  Form,
} from "@/components/ui/form";

type TeamFormProps = {
  team?: Team;
  closeModal: () => void;
};

const TeamForm = ({ team, closeModal }: TeamFormProps) => {
  const { toast } = useToast();

  const editing = !!team?.id;

  const router = useRouter();
  const utils = trpc.useUtils();

  const form = useForm<NewTeamParams>({
    resolver: zodResolver(insertTeamParams),
    defaultValues: team ?? { name: "" },
  });

  const onSuccess = async (action: "create" | "update" | "delete") => {
    await utils.teams.getTeams.invalidate();
    router.refresh();
    closeModal();
    toast({
      title: "Success",
      description: `Team ${action}d!`,
      variant: "default",
    });
  };

  const { mutate: createTeam, isLoading: isCreating } =
    trpc.teams.createTeam.useMutation({
      onSuccess: () => onSuccess("create"),
    });

  const { mutate: updateTeam, isLoading: isUpdating } =
    trpc.teams.updateTeam.useMutation({
      onSuccess: () => onSuccess("update"),
    });

  const { mutate: deleteTeam, isLoading: isDeleting } =
    trpc.teams.deleteTeam.useMutation({
      onSuccess: () => onSuccess("delete"),
    });

  const handleSubmit = (values: NewTeamParams) => {
    if (editing) updateTeam({ ...values, id: team.id });
    else createTeam(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={"space-y-8"}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="mr-1"
          disabled={isCreating || isUpdating}
        >
          {editing
            ? `Sav${isUpdating ? "ing..." : "e"}`
            : `Creat${isCreating ? "ing..." : "e"}`}
        </Button>
        {editing ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => deleteTeam({ id: team.id })}
          >
            Delet{isDeleting ? "ing..." : "e"}
          </Button>
        ) : null}
      </form>
    </Form>
  );
};

export default TeamForm;
