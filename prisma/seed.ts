/**
 * Adds seed data to your db
 *
 * @link https://www.prisma.io/docs/guides/database/seed-database
 */
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

import { prisma } from '../src/server/db/prismaClient';
import { TestUsers } from '../src/lib/constant';
import { imgUrl } from '../src/helpers';

async function createUser_Account_Post_And_Card(opts: {
  user: Prisma.UserCreateInput & {
    password: string;
    email: string | undefined;
  };
}) {
  const { name, email, password } = opts.user;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hash(password, 12),
      emailVerified: new Date(),
      image: imgUrl,
    },
  });
  if (user) {
    await Promise.all([
      prisma.account.create({
        data: {
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: user.id,
          user: { connect: { id: user.id } },
        },
      }),
      prisma.post.createMany({
        data: [{ text: 'How to make an omelette', userId: user.id }],
      }),
      prisma.card.createMany({
        data: [{ name: 'Test card1', userId: user.id }],
      }),
    ]);
  }
  console.log('SUCCESSFULLY CREATED USER AND RECORDS');
}

async function main() {
  try {
    await Promise.all(
      TestUsers.map((user) => createUser_Account_Post_And_Card({ user })),
    );
  } catch (err) {
    console.log(err);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
