import type { NextPage } from 'next';

import { Title } from '@mantine/core';

const Home: NextPage & { isProtected: boolean; pageTitle: string } = () => {
  return <Title>This is the home page</Title>;
};

Home.isProtected = true;
Home.pageTitle = 'Home';

export default Home;
