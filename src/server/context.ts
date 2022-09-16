import * as trpcNext from '@trpc/server/adapters/next';
import * as trpc from '@trpc/server';

import { NodeHTTPCreateContextFnOptions } from '@trpc/server/adapters/node-http';
import { getSession } from 'next-auth/react';
import { IncomingMessage } from 'http';

import ws from 'ws';

import { prisma } from './db/prismaClient';

export const createContext = async (
  opts:
    | trpcNext.CreateNextContextOptions
    | NodeHTTPCreateContextFnOptions<IncomingMessage, ws>,
) => {
  const { req, res } = opts;
  const session = await getSession({ req });

  return {
    req,
    res,
    prisma,
    session,
  };
};

export type Context = trpc.inferAsyncReturnType<typeof createContext>;
