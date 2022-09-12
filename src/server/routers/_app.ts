/**
 * This file contains the root router of your tRPC-backend
 */
import { Subscription } from '@trpc/server';
import { clearInterval } from 'timers';

import { createRouter } from '../createRouter';
// import { requestRouter } from './request';
import { userRouter } from './user';
import { postRouter } from './post';
import { cardRouter } from './card';

import superjson from 'superjson';

/**
 * Create your application's root router
 * If you want to use SSG, you need export this
 * @link https://trpc.io/docs/ssg
 * @link https://trpc.io/docs/router
 */
export const appRouter = createRouter()
  /**
   * Add data transformers
   * @link https://trpc.io/docs/data-transformers
   */
  .transformer(superjson)
  /**
   * Optionally do custom error (type safe!) formatting
   * @link https://trpc.io/docs/error-formatting
   */
  // .formatError(({ shape, error }) => { })
  .merge('post.', postRouter)
  .merge('card.', cardRouter)
  .merge('user.', userRouter)
  // .merge('request.', requestRouter)
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
