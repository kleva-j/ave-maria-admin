import { Context } from './context';
import * as trpc from '@trpc/server';

/**
 * Helper function to create a router with context
 */
export function createRouter() {
  return trpc.router<Context>();
}

/**
 * Creates a tRPC router that asserts all queries and mutations are from an authorized user. Will throw an unauthorized error if a user is not signed in.
 **/
export function createProtectedRouter() {
  return createRouter().middleware(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user)
      throw new trpc.TRPCError({ code: 'UNAUTHORIZED' });
    return next({
      ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } },
    });
  });
}
