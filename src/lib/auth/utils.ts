import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type AuthSession = {
  session: {
    user: {
      id: string;
      name?: string;
      email?: string;
      expireAt?: number;
    };
  } | null;
}

export const getUserAuth = async () => {
  // find out more about setting up 'sessionClaims' (custom sessions) here: https://clerk.com/docs/backend-requests/making/custom-session-token
  const { userId, sessionClaims } = auth();

  return userId
    ? ({
        session: {
          user: {
            id: userId,
            name: sessionClaims?.fullName,
            email: sessionClaims?.primaryEmail,
            imageUrl: sessionClaims?.imageUrl,
            expireAt: sessionClaims.exp,
          },
        },
      } as AuthSession)
    : { session: null };
};

export const checkAuth = async () => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");
};
