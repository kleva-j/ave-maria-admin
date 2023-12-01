/* eslint-disable @typescript-eslint/no-unsafe-return */
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/signin(.*)", "/signup(.*)", "/sso-callback(.*)"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
