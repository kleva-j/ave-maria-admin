import { z } from 'zod';

export type IconMaptype = { [key: string]: JSX.Element };

export type PasswordReqType = {
  meets: boolean;
  label: string;
};

export type Awaitable<T> = T | PromiseLike<T>;

export interface CommonProviderOptions {
  id: string;
  name: string;
  type: ProviderType;
  options?: Record<string, unknown>;
}

export type loginCredentials = {
  email: string;
  password: string;
  authType?: AuthState.login;
};

export type signupCredentials = Omit<loginCredentials, 'authType'> & {
  name: string;
  authType?: AuthState.signup;
};

export type ProviderType = 'oauth' | 'email' | 'credentials';

export type AuthData = {
  email: string;
  password: string;
  authType: string;
  redirect?: boolean;
};

export type formError = {
  code: number;
  title: string;
  message: string;
};

export type formResult = {
  error?: string;
  ok: boolean;
  url?: string;
  status: string;
};

export enum AuthState {
  login = 'login',
  signup = 'signup',
}

export const AuthSchema = z.object({
  email: z.string().email({ message: 'Invalid email' }),
  password: z.string().regex(/[$&+,:;=?@#|'<>.^*()%!-]/, {
    message: 'Password does not meet requirements',
  }),
});

export const signupAuthSchema = AuthSchema.merge(
  z.object({
    name: z.string().min(2, { message: 'Name should have at least 2 letters' }),
  }),
);
