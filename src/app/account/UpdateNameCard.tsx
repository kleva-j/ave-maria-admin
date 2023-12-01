"use client";

import { AccountCard, AccountCardFooter, AccountCardBody } from "./AccountCard";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function UpdateNameCard({ name }: { name: string }) {
  const router = useRouter();

  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();

    const target = event.target as HTMLFormElement;
    const form = new FormData(target);
    const { name } = Object.fromEntries(form.entries()) as { name: string };

    if (name.length < 3) {
      toast({
        description: "Name must be longer than 3 characters.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/account", {
        method: "PUT",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 200)
        toast({ description: "Successfully updated name!" });
      router.refresh();
    });
  };

  return (
    <AccountCard
      params={{
        header: "Your Name",
        description:
          "Please enter your full name, or a display name you are comfortable with.",
      }}
    >
      <form onSubmit={handleSubmit}>
        <AccountCardBody>
          <Input defaultValue={name ?? ""} name="name" disabled={true} />
        </AccountCardBody>
        <AccountCardFooter description="64 characters maximum">
          <Button disabled={true}>Update Name</Button>
        </AccountCardFooter>
      </form>
    </AccountCard>
  );
}
