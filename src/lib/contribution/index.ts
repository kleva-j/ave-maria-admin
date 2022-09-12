import { prisma } from 'server/db/prismaClient';
import { Prisma } from '@prisma/client';

export async function getContributionsResolver(
  input: Prisma.ContributionFindManyArgs,
) {
  try {
    const contributions = await prisma.contribution.findMany({ ...input });
    return contributions;
  } catch (err) {}
}

export async function getSingleContributionResolver(
  input: Prisma.ContributionFindUniqueArgs,
) {
  try {
    const contribution = await prisma.contribution.findUnique({ ...input });
    return contribution;
  } catch (err) {
    throw err;
  }
}
