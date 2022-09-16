import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { jwtAuthOptions } from 'lib/auth';

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req: NextRequest) {
    // return NextResponse.rewrite(new URL('/admin', req.url));
  },
  {
    // jwt: { decode: jwtAuthOptions.decode },
    callbacks: {
      authorized: (params) => {
        const { token } = params;
        return token?.user?.role === 'admin';
      },
    },
  },
);

export const config = {
  matcher: [
    '/admin',
    '/admin/:pages*',
    '/api/admin/users',
    '/api/admin/users/:id*',
    '/api/admin/analytics',
    '/api/admin/contributions',
  ],
};
