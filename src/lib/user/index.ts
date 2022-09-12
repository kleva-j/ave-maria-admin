import { prisma } from '../../server/db/prismaClient';
import { Prisma } from '@prisma/client';

export async function getManyUsersResolver(input: Prisma.UserFindManyArgs) {
  try {
    const users = await prisma.user.findMany({ ...input });
    return users;
  } catch (err) {}
}

export async function getSingleUserResolver(input: Prisma.UserFindUniqueArgs) {
  try {
    const user = await prisma.user.findUnique({ ...input });
    return user;
  } catch (err) {
    throw err;
  }
}
