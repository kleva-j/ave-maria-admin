import { checkAuth, getUserAuth } from "@/lib/auth/utils";

import UserSettings from "@/app/account/UserSettings";

export default async function Account() {
  await checkAuth();

  const { session } = await getUserAuth();
  
  return (
    <main>
      <h1 className="text-3xl font-semibold my-6">Account</h1>
      <div className="space-y-6">
        <UserSettings session={session} />
      </div>
    </main>
  );
}
