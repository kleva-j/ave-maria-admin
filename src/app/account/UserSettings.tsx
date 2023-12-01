"use client";

import type { AuthSession } from "@/lib/auth/utils";

import UpdateEmailCard from "@/app/account/UpdateEmailCard";
import UpdateNameCard from "@/app/account/UpdateNameCard";

type UserSettingsProps = { session: AuthSession["session"] };

export default function UserSettings({ session }: UserSettingsProps) {
  return (
    <>
      <UpdateNameCard name={session?.user.name ?? ""} />
      <UpdateEmailCard email={session?.user.email ?? ""} />
    </>
  );
}
