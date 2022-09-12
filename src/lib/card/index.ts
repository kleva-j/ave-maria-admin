import { prisma } from 'server/db/prismaClient';
import { Prisma } from '@prisma/client';

export enum CardStatusModel {
  active = 'active',
  closed = 'closed',
  deleted = 'deleted',
  finished = 'finished',
}

export async function getManyCardResolver(input: Prisma.CardFindManyArgs) {
  try {
    const cards = await prisma.card.findMany({ ...input });
    return cards;
  } catch (err) {
    throw err;
  }
}

export async function getSingleCardResolver(input: Prisma.CardFindUniqueArgs) {
  try {
    const card = await prisma.card.findUnique({ ...input });
    return card;
  } catch (err) {
    throw err;
  }
}
