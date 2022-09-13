import * as trpc from '@trpc/server';

import { Roles } from '@prisma/client';
import { z } from 'zod';

import { Action, handleAccess } from '../../lib/accessControl';
import { createProtectedRouter } from '../createRouter';

const resource = 'user';

const InputSchema = z.object({
  id: z.string().cuid({ message: `invalid ${resource} id` }),
  email: z.string().email({ message: 'Invalid email' }).optional(),
  role: z.enum([Roles.admin, Roles.user, Roles.agent, Roles.guest]),
  name: z.string().min(2, { message: 'Name should have at least 2 letters' }),
});

export const userRouter = createProtectedRouter()
  .query('one', {
    input: InputSchema.pick({ id: true, email: true }),
    async resolve({ input, ctx: { prisma, session } }) {
      const user = session.user as any;
      try {
        const { data } = await handleAccess({
          query: async (input) => await prisma.user.findUnique(input),
          isOwnerFunc: () => input.id === user.id,
          action: Action.read,
          resource,
          input,
          user,
        });
        return { user: data };
      } catch (err) {
        throw err;
      }
    },
  })
  .middleware(({ ctx, next }) => {
    const allowedRoles = [Roles.admin, Roles.agent];
    const user = ctx.session.user as any;
    if (!allowedRoles.includes(user.role))
      throw new trpc.TRPCError({ code: 'FORBIDDEN' });
    return next({
      ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } },
    });
  })
  .query('all', {
    input: InputSchema.partial(),
    async resolve({ input, ctx: { prisma } }) {
      const users = await prisma.user.findMany({ where: { ...input } });
      return { users };
    },
  });
