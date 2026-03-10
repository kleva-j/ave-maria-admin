import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  component: RouteComponent,
  loader: async () => {
    const { user } = await getAuth();
    if (!user) {
      const signInUrl = await getSignInUrl();
      throw redirect({ href: signInUrl });
    }
    return { user };
  },
});

function RouteComponent() {
  return <div>Hello "/_protected"!</div>;
}
