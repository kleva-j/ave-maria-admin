import { Button } from "@/components/ui/button";
import { getUserAuth } from "@/lib/auth/utils";

import Link from "next/link";

export default async function Home() {
  const userAuth = await getUserAuth();

  return (
    <main className="space-y-6">
      <Link href="/account">
        <Button variant="outline">Account and Billing</Button>
      </Link>
      <pre className="bg-slate-100 p-4 dark:bg-slate-800">
        {JSON.stringify(userAuth, null, 2)}
      </pre>
    </main>
  );
}
