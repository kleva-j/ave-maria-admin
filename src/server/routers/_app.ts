import { Subscription } from '@trpc/server';
import { clearInterval } from 'timers';
import { ZodError } from 'zod';

import { createRouter } from '../createRouter';
import { requestRouter } from './request';
import { userRouter } from './user';
import { postRouter } from './post';
import { cardRouter } from './card';

import superjson from 'superjson';

export const appRouter = createRouter()
  .transformer(superjson)
  .formatError(({ shape, error }) => {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  })
  .merge('post.', postRouter)
  .merge('card.', cardRouter)
  .merge('user.', userRouter)
  .merge('request.', requestRouter)
  .subscription('randomNumber', {
    resolve() {
      return new Subscription<number>((emit) => {
        const int = setInterval(() => {
          emit.data(Math.random());
        }, 500);
        return () => {
          clearInterval(int);
        };
      });
    },
  });

export type AppRouter = typeof appRouter;
