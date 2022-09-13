import { z } from 'zod';
import { CardStatus } from '@prisma/client';

import {
  handleManyAccess,
  handleAccess,
  Action,
} from '../../lib/accessControl';
import { createProtectedRouter } from '../createRouter';

const resource = 'card';

const InputSchema = z.object({
  status: z.nativeEnum(CardStatus).optional(),
  id: z.string().cuid({ message: `invalid ${resource} id` }),
  name: z.string().min(2, { message: 'Name should have at least 2 letters' }),
});

export const cardRouter = createProtectedRouter()
  .query('one', {
    input: InputSchema.omit({ name: true }),
    async resolve({ input, ctx: { prisma, session } }) {
      const user = session.user as any;
      try {
        const { data } = await handleAccess({
          query: async (input) => await prisma.card.findUnique(input),
          isOwnerFunc: () => input.id === user.id,
          action: Action.read,
          resource,
          input,
          user,
        });
        return { card: data };
      } catch (err) {
        throw err;
      }
    },
  })
  .query('all', {
    input: InputSchema.partial(),
    async resolve({ input, ctx: { prisma, session } }) {
      const user = session.user as any;
      const { data } = await handleManyAccess({
        query: async (input) => await prisma.card.findMany(input),
        action: Action.read,
        resource,
        input,
        user,
      });
      return { cards: data };
    },
  });
