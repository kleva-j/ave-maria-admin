import { ModeToggle } from "@/components/ui/ThemeToggle";
import { getUserAuth } from "@/lib/auth/utils";
import { UserButton } from "@clerk/nextjs";

import Link from "next/link";

export default async function Navbar() {
  const { session } = await getUserAuth();

  if (session?.user) {
    return (
      <nav className="py-2 flex items-center justify-between transition-all duration-300">
        <h1 className="font-semibold hover:opacity-75 transition-hover cursor-pointer">
          <Link href="/">Logo</Link>
        </h1>
        <div className="space-x-2 flex items-center">
          <ModeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>
    );
  } else return null;
}
