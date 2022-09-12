import type { GetServerSidePropsContext } from 'next';

import * as trpc from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';

import ws from 'ws';

import { NodeHTTPCreateContextFnOptions } from '@trpc/server/adapters/node-http';
import { getSession } from 'next-auth/react';
import { prisma } from './db/prismaClient';
import { IncomingMessage } from 'http';

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export const createContext = async ({
  req,
  res,
}:
  | trpcNext.CreateNextContextOptions
  | NodeHTTPCreateContextFnOptions<IncomingMessage, ws>) => {
  const session = await getSession({ req });
  return {
    req,
    res,
    prisma,
    session,
  };
};

export type Context = trpc.inferAsyncReturnType<typeof createContext>;
