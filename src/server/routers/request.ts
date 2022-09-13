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
  id: z.string().cuid({ message: `invalid ${resource} id` }),
  type: z.nativeEnum(RequestType).optional(),
  status: z.nativeEnum(RequestStatus).optional(),
  userId: z.string().cuid({ message: `invalid user id` }).optional(),
  cardId: z.string().uuid({ message: `invalid card id` }).optional(),
  amount: z
    .number()
    .min(100, { message: `Select an amount higher than 100` })
    .optional(),
});

const InputSchema = Schema.partial();

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
    input: InputSchema,
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
