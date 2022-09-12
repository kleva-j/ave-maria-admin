import { prisma } from 'server/db/prismaClient';
import { Prisma } from '@prisma/client';

export async function getManyRequestsResolver(
  input: Prisma.RequestFindManyArgs,
) {
  try {
    const requests = await prisma.request.findMany({ ...input });
    return requests;
  } catch (err) {}
}

export async function getSingleRequestResolver(
  input: Prisma.RequestFindUniqueArgs,
) {
  try {
    const request = await prisma.request.findUnique({ ...input });
    return request;
  } catch (err) {
    throw err;
  }
}
