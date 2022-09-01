import { prisma } from 'server/db/prismaClient';
import { Prisma } from '@prisma/client';

type Args = Prisma.UserFindManyArgs;

export async function getAllUsers(args?: Args): Promise<any> {
  try {
    const allUsers = await prisma.user.findMany({ ...args });
    return allUsers;
  } catch (err) {}
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}
