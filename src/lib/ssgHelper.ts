/* eslint-disable react/display-name */
import * as trpcNext from '@trpc/server/adapters/next';

import type { GetServerSidePropsContext } from 'next';

import superjson from 'superjson';
import ws from 'ws';

import { NodeHTTPCreateContextFnOptions } from '@trpc/server/adapters/node-http';
import { appRouter, AppRouter } from 'server/routers/_app';
import { createSSGHelpers } from '@trpc/react/ssg';
import { createContext } from 'server/context';
import { IncomingMessage } from 'http';

export async function ssgHelpers(context: GetServerSidePropsContext) {
  const { req, res } = context;
  const opts = { req, res } as
    | trpcNext.CreateNextContextOptions
    | NodeHTTPCreateContextFnOptions<IncomingMessage, ws>;

  return createSSGHelpers<AppRouter>({
    router: appRouter,
    ctx: await createContext(opts),
    transformer: superjson,
  });
}
