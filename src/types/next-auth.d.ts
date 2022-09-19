import { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      role?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** OpenID ID Token */
    refresh_token?: string;
    accessToken?: string;
    expires_at?: number;
    user?: {
      emailVerified?: Date | null;
      role?: string;
      id?: string | undefined;
    } & DefaultUser;
  }
}
