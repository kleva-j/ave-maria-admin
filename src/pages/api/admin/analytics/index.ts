import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const allowedMethods = ['GET'];
  if (!allowedMethods.includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
  }
  return res.status(200).json({ message: 'Success' });
}
