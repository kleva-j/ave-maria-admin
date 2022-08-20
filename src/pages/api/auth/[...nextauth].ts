import type { NextAuthOptions } from 'next-auth';

import { AuthSchema, signupAuthSchema, AuthState } from 'types';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from 'server/db/prismaClient';
import { hash, compare } from 'bcryptjs';

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
      async authorize(formData) {
        const user = { name: formData?.name, email: formData?.email };

        if (formData?.authType === AuthState.login)
          AuthSchema.parse({ email: user.email, password: formData?.password });

        if (formData?.authType === AuthState.signup)
          signupAuthSchema.parse({ ...user, password: formData?.password });

        try {
          const userExist = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!userExist && formData?.authType === AuthState.login)
            throw new Error('An Account with this credential does not exist.');

          if (
            userExist &&
            formData?.authType === AuthState.login &&
            !userExist.passwordHash
          ) {
            throw new Error('Try signing in with a social login.');
          }

          if (
            userExist &&
            userExist.passwordHash &&
            formData?.authType === AuthState.login
          ) {
            const checkPassword = await compare(
              formData?.password,
              userExist.passwordHash as string,
            );

            if (!checkPassword) throw new Error('Incorrect credentials!');

            const { id, name, email, image, emailVerified } = userExist;

            return { id, name, email, image, emailVerified };
          }

          if (!userExist && formData?.authType === AuthState.signup) {
            const { id, name, email, image, emailVerified } =
              await prisma.user.create({
                data: {
                  name: user.name,
                  email: user.email,
                  passwordHash: await hash(formData?.password, 12),
                },
              });
            return { id, name, email, emailVerified, image };
          }
          return null;
        } catch (err) {
          throw err;
        }
      },
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
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
    EmailProvider({ server: process.env.EMAIL_SERVER ?? '' }),
  ],
  secret: process.env.NEXTAUTH_SECRET ?? '',
  pages: { signIn: '/auth/signin', verifyRequest: '/auth/verify-request' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  debug: true,
};
export default NextAuth({ ...authOptions });
