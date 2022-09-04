import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { jwtAuthOptions } from 'lib/auth';

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req: NextRequest) {
    // console.log({ ...req });
    // console.log('<<<<<<<<<<< GOT HERE >>>>>>>>>>>>');
    // return NextResponse.rewrite(new URL('/admin', req.url));
  },
  {
    // jwt: { decode: jwtAuthOptions.decode },
    callbacks: {
      authorized: ({ token }) => {
        // console.log({ token }, '<<<<< TOKEN >>>>>');
        return token?.user?.role === 'admin';
      },
    },
  },
);

export const config = {
  matcher: [
    '/admin',
    '/api/admin/users',
    '/api/admin/users/:id*',
    '/api/admin/analytics',
    '/api/admin/contributions',
  ],
};
