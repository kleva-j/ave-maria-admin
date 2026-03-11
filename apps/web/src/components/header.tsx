import { Button } from "@avm-daily/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

export default function Header() {
  const { user, loading, signOut } = useAuth();
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
                onClick={() => void signOut({ returnTo: "/" })}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm">
                Sign in
              </Link>
              <a href="/login?mode=signup" className="text-sm">
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
      <hr />
    </div>
  );
}
