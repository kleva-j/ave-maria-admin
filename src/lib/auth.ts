import { AuthSchema, signupAuthSchema, AuthState } from 'types';
import { prisma } from 'server/db/prismaClient';
import { hash, compare } from 'bcryptjs';
import { formatISO } from 'date-fns';

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
    emailVerified: formatISO(new Date()),
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
      const { id, name, email, image, emailVerified } =
        await prisma.user.create({
          data: {
            name: user.name,
            email: user.email,
            passwordHash: await hash(formData?.password, 12),
          },
        });
      return { id, name, email, emailVerified, image };
    }
    return null;
  } catch (err) {
    throw err;
  }
};
