import { DEFAULT_RETURN_PATH, getSafeReturnPathname } from "@/lib/auth";
import { buttonVariants } from "@avm-daily/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Input } from "@avm-daily/ui/components/input";
import { cn } from "@avm-daily/ui/lib/utils";
import { z } from "zod";

import {
  getSignInUrl,
  getSignUpUrl,
} from "@workos/authkit-tanstack-react-start";

import {
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  Card,
} from "@avm-daily/ui/components/card";

import {
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Field,
} from "@avm-daily/ui/components/field";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    mode: z.enum(["signin", "signup"]).optional(),
    returnTo: z.string().optional(),
  }),
  loader: async ({ location }) => {
    const search = location.search as Record<string, string>;
    const returnTo = getSafeReturnPathname(
      new URLSearchParams(search).toString(),
      DEFAULT_RETURN_PATH
    );

    const signInUrl = await getSignInUrl();
    const signUpUrl = await getSignUpUrl();

    return {
      signInUrl,
      signUpUrl,
      returnTo,
      mode: search.mode ?? "signin",
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const loaderData = Route.useLoaderData();
  const { signInUrl, signUpUrl, returnTo, mode } = loaderData;

  const isSignUp = mode === "signup";

  const authUrl = isSignUp ? signUpUrl : signInUrl;

  const authUrlWithReturn = returnTo
    ? `${authUrl}${
        authUrl.includes("?") ? "&" : "?"
      }returnTo=${encodeURIComponent(returnTo)}`
    : authUrl;

  console.log({ authUrlWithReturn });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className={cn("flex flex-col gap-6")}>
          <Card>
            <CardHeader>
              <CardTitle>
                {isSignUp ? "Create an account" : "Login to your account"}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Enter your details below to create your account"
                  : "Enter your email below to login to your account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <a
                    href={authUrlWithReturn}
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "w-full"
                    )}
                  >
                    {isSignUp ? "Sign up with AuthKit" : "Sign in with AuthKit"}
                  </a>
                </Field>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" placeholder="m@example.com" />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input id="password" type="password" />
                </Field>

                <Field>
                  <a
                    href={authUrlWithReturn}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full"
                    )}
                  >
                    Continue with Email
                  </a>

                  <FieldDescription className="text-center">
                    {isSignUp ? (
                      <>
                        Already have an account?{" "}
                        <Link to="/login" search={{ mode: "signin" }}>
                          Sign in
                        </Link>
                      </>
                    ) : (
                      <>
                        Don't have an account?{" "}
                        <Link to="/login" search={{ mode: "signup" }}>
                          Sign up
                        </Link>
                      </>
                    )}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
