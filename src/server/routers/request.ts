import { RequestStatus, RequestType } from '@prisma/client';
import { z } from 'zod';

import {
  handleManyAccess,
  handleAccess,
  Action,
} from '../../lib/accessControl';
import { createProtectedRouter } from '../createRouter';

const resource = 'request';

const Schema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.nativeEnum(RequestType),
  cardId: z.string().nullable(),
  info: z.string().nullable(),
  amount: z.number(),
  status: z.nativeEnum(RequestStatus),
  approvedAt: z.date(),
  approvedBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  date: z.date(),
});

const InputSchema = Schema.omit({ updatedAt: true }).optional();

export const requestRouter = createProtectedRouter()
  .query('one', {
    input: Schema.pick({ id: true }),
    async resolve({ input, ctx: { prisma, session } }) {
      const user = session.user as any;
      try {
        const { data } = await handleAccess({
          query: async (input) => await prisma.request.findUnique(input),
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
  .query('all', {
    input: InputSchema.optional(),
    async resolve({ input, ctx: { prisma, session } }) {
      const user = session.user as any;
      const { data } = await handleManyAccess({
        query: async (input) => await prisma.card.findMany(input),
        action: Action.read,
        resource,
        input,
        user,
      });
      return { requests: data };
    },
  });
