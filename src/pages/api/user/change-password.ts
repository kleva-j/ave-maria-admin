import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';

import { hashPassword, verifyPassword } from 'lib/auth';
import { prisma } from 'server/db/prismaClient';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'PATCH') return;

  const session = await getSession({ req: req });

  if (!session?.user) {
    res.status(401).json({ message: 'Not authenticated!' });
    return;
  }

  const userEmail = session?.user.email as string;
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;

  const user = await prisma.user.findUnique({ where: { email: userEmail } });

  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  const currentPassword = user.passwordHash as string;

  const passwordsAreEqual = await verifyPassword(oldPassword, currentPassword);

  if (!passwordsAreEqual) {
    res.status(403).json({ message: 'Invalid password.' });
    return;
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { email: userEmail },
    data: { passwordHash: hashedPassword },
  });

  res.status(200).json({ message: 'Password updated!' });
}

export default handler;
