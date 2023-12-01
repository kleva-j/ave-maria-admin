"use client";

import type { Team } from "@/server/db/schema/teams";

import { Button } from "@/components/ui/button";
import { useState } from "react";

import {
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  Dialog,
} from "@/components/ui/dialog";

import TeamForm from "./TeamForm";

type TeamModalProps = {
  team?: Team;
  emptyState?: boolean;
};

export default function TeamModal({ team, emptyState }: TeamModalProps) {
  const [open, setOpen] = useState(false);

  const closeModal = () => setOpen(false);

  const editing = !!team?.id;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {emptyState ? (
          <Button>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New Team
          </Button>
        ) : (
          <Button
            variant={editing ? "ghost" : "outline"}
            size={editing ? "sm" : "icon"}
          >
            {editing ? "Edit" : "+"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{editing ? "Edit" : "Create"} Team</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-5">
          <TeamForm closeModal={closeModal} team={team} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
