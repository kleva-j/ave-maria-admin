import { DEFAULT_RETURN_PATH, getSafeReturnPathname } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@avm-daily/ui/components/button";
import { Input } from "@avm-daily/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

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
  FieldError,
  Field,
} from "@avm-daily/ui/components/field";

const formSchema = z.object({
  email: z.email("Email is required"),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    returnTo: z.string().optional().default(DEFAULT_RETURN_PATH),
  }),
  loader: async () => {
    const returnTo = getSafeReturnPathname(
      new URLSearchParams().toString(),
      DEFAULT_RETURN_PATH
    );

    return { returnTo };
  },
  component: LoginPage,
});

function LoginPage() {
  const loaderData = Route.useLoaderData();
  const { returnTo } = loaderData;

  console.log("returnTo", { returnTo });

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      const { email, password } = value;
      console.log({ email, password });
    },
    validators: { onSubmit: formSchema },
  });

  return (
    <div className="flex h-[calc(100vh-2.5rem)] w-full items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit}>
            <FieldGroup>
              <form.Field name="email">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="example@example.com"
                        autoComplete="off"
                        required
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="password">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="Enter your password"
                        autoComplete="off"
                        required
                      />
                      <FieldDescription>
                        Must be at least 8 characters long.
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              <Field>
                <Button type="submit" className="cursor-pointer w-full">
                  Login
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
