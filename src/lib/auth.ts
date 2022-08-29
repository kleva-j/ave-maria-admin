import { AuthSchema, signupAuthSchema, AuthState } from 'types';
import { prisma } from 'server/db/prismaClient';
import { hash, compare } from 'bcryptjs';

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return compare(password, hashedPassword);
}

export const getSocialProfile = (profile: any) => {
  return {
    email: profile.email,
    role: getUserRole(profile.email),
    name: profile.name ?? profile.login,
    emailVerified: new Date().toISOString(),
    image: profile.picture ?? profile.avatar_url,
    id: profile.id ? profile.id.toString() : profile.sub,
  };
};

export const getUserRole = (email: string) =>
  checkIfAdmin(email) ? 'admin' : 'user';

export const checkIfAdmin = (email: string) =>
  (process.env.ADMINISTRATOR ?? '').split(',').includes(email);

type formData =
  | Record<'email' | 'password' | 'name' | 'authType', string>
  | undefined;

export const Authorize = async (formData: formData) => {
  const user = { name: formData?.name, email: formData?.email };

  if (formData?.authType === AuthState.login)
    AuthSchema.parse({ email: user.email, password: formData?.password });

  if (formData?.authType === AuthState.signup)
    signupAuthSchema.parse({ ...user, password: formData?.password });

  try {
    const userExist = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!userExist && formData?.authType === AuthState.login)
      throw new Error('An Account with this credential does not exist.');

    if (
      userExist &&
      formData?.authType === AuthState.login &&
      !userExist.passwordHash
    ) {
      throw new Error('Try signing in with a social login.');
    }

    if (
      userExist &&
      userExist.passwordHash &&
      formData?.authType === AuthState.login
    ) {
      const checkPassword = await compare(
        formData?.password,
        userExist.passwordHash as string,
      );

      if (!checkPassword) throw new Error('Incorrect credentials!');

      const { id, name, email, image, emailVerified } = userExist;

      return { id, name, email, image, emailVerified };
    }

    if (!userExist && formData?.authType === AuthState.signup) {
      const newUser = await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          passwordHash: await hash(formData?.password, 12),
          role: getUserRole(user.email ?? ''),
        },
      });
      if (!newUser) throw new Error('Unable to create user account.');

      const { id, name, email, image, emailVerified, role } = newUser;

      const account = await prisma.account.create({
        data: {
          userId: id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: id,
        },
      });

      if (!(newUser && account))
        throw new Error('Unable to link account to created user profile');
      return { id, name, email, emailVerified, image, role };
    }
    return null;
  } catch (err) {
    throw err;
  }
};

const getGoogleTokenUrl = (token: any) =>
  'https://oauth2.googleapis.com/token?' +
  new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
  });

export const getCredentialsTokenUrl = () =>
  process.env.API_URL + 'auth/refreshToken';

export const getProviderRefreshTokenParams = (provider: string, token: any) => {
  return {
    url: {
      google: getGoogleTokenUrl(token),
      credentials: getCredentialsTokenUrl(),
    }[provider] as string,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: { ...{ credentials: { token: token.refreshToken } }[provider] },
  };
};

export const refreshAccessToken = async (token: any) => {
  try {
    const url =
      'https://oauth2.googleapis.com/token?' +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      });

    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });

    const refreshedTokens = await r.json();

    if (!r.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.log(error);

    return { ...token, error: 'RefreshAccessTokenError' };
  }
};
