/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { NextAuthOptions } from 'next-auth';

import { getSocialProfile, checkIfAdmin, Authorize } from 'lib/auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from 'server/db/prismaClient';

import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import EmailProvider from 'next-auth/providers/email';
import NextAuth from 'next-auth';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      profile: getSocialProfile,
    }),
    EmailProvider({ server: process.env.EMAIL_SERVER ?? '' }),
  ],
  secret: process.env.NEXTAUTH_SECRET ?? '',
  pages: { signIn: '/auth/signin', verifyRequest: '/auth/verify-request' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  debug: true,
  callbacks: {
    async session({ session, token }) {
      session.user.role = token.isAdmin ? 'admin' : 'user';
      return session;
    },
    async jwt({ token, user, account }) {
      if (user)
        token.isAdmin =
          checkIfAdmin(user.email ?? '') && user?.role === 'admin';
      if (account) token.accessToken = account.access_token;
      return token;
    },
  },
};

export default NextAuth({ ...authOptions });
