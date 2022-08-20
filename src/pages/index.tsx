import type { NextPage } from 'next';

import { Title } from '@mantine/core';

const Home: NextPage & { isProtected: boolean } = () => {
  return <Title>This is the home page</Title>;
};

Home.isProtected = true;

export default Home;
