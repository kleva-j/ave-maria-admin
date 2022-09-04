/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextAuthOptions } from 'next-auth';

import {
  refreshAccessToken,
  getSocialProfile,
  checkIfAdmin,
  Authorize,
} from 'lib/auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from 'server/db/prismaClient';
import { JWT } from 'next-auth/jwt';

import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import NextAuth from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        name: { label: 'Name', type: 'text', placeholder: 'Name' },
        email: { label: 'Email', type: 'email', placeholder: 'Email' },
        password: { label: 'Password', type: 'password' },
        authType: { label: 'AuthType', type: 'text' },
      },
      authorize: Authorize,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization:
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        }),
      profile: getSocialProfile,
    }),
    EmailProvider({ server: process.env.EMAIL_SERVER ?? '' }),
  ],
  secret: process.env.NEXTAUTH_SECRET ?? '',
  pages: { signIn: '/auth/signin', verifyRequest: '/auth/verify-request' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    session: async ({ session, token }) => {
      const { accessToken, user } = token;
      return { ...session, accessToken, user: { ...user } };
    },
    async jwt({ token, user, account }) {
      const { name, email, picture: image, sub, expires_at } = token;
      const id = sub as string;
      const reformedToken: JWT = {};
      if (user) {
        reformedToken.isAdmin =
          checkIfAdmin(user.email ?? '') && user?.role === 'admin';
      }
      if (user && account) {
        const emailVerified = user.emailVerified as Date | null;
        const role = user.role as string;
        reformedToken.provider = account.provider;
        reformedToken.expires_at = account?.expires_at;
        reformedToken.accessToken = account?.access_token;
        reformedToken.refreshToken = account?.refresh_token;
        reformedToken.user = { id, name, email, image, emailVerified, role };
      }

      if (reformedToken.expires_at) return reformedToken;
      if (expires_at && Date.now() < expires_at * 1000) return token;
      return token.provider === 'google' ? refreshAccessToken(token) : token;
    },
  },
  // jwt: jwtAuthOptions,
  adapter: PrismaAdapter(prisma),
};

export default async function (req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions);
}
