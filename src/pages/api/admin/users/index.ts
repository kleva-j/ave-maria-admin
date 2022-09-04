import { NextApiRequest, NextApiResponse } from 'next';
import { getAllUsers, getUserById } from 'lib/user';

const allowedMethods = ['GET'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  if (!allowedMethods.includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
  }

  try {
    if (req.method === 'GET') {
      let { id } = req.query;
      id = id as string;

      const result = id ? await getUserById(id) : await getAllUsers();

      return res.status(200).json({ message: 'Successful', result });
    }
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ statusCode: 500, message: err.message });
    }
  }
}
