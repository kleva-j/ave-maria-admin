import { Button } from "@avm-daily/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

import { signOutUser } from "@/server/auth.functions";

export default function Header() {
  const { user, loading } = useAuth();
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const result = await signOutUser({ data: { returnTo: "/" } });
      if (result instanceof Response) {
        const message = await result.text();
        throw new Error(message || "Unable to sign out.");
      }
      return result;
    },
    onSuccess: ({ logoutUrl }) => {
      window.location.assign(logoutUrl);
    },
  });
  const links = [
    { to: "/", label: "Home" },
    { to: "/todos", label: "Todos" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-sm text-muted-foreground">Loading...</span>
          ) : user ? (
            <>
              <Link to="/dashboard" className="text-sm">
                Dashboard
              </Link>
              <Button
                variant="outline"
                size="sm"
                disabled={signOutMutation.isPending}
                onClick={() => signOutMutation.mutate()}
              >
                {signOutMutation.isPending ? "Signing out..." : "Sign out"}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
      <hr />
    </div>
  );
}
