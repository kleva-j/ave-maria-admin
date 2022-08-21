import { ClientSafeProvider, getProviders } from 'next-auth/react';
import { authOptions } from 'pages/api/auth/[...nextauth]';
import { unstable_getServerSession } from 'next-auth/next';
import { Container, Center } from '@mantine/core';
import { GetServerSideProps } from 'next';

import AuthForm from 'components/forms/Auth';

type Props = {
  providers: Record<string, ClientSafeProvider>;
};

const SignIn = ({ providers }: Props) => {
  return (
    <Container>
      <Center
        sx={{
          marginTop: '90px',
          '@media (min-width: 405px)': {
            marginTop: '140px',
          },
          '@media (min-width: 875px)': {
            marginTop: '240px',
          },
        }}
      >
        <AuthForm providers={providers} />
      </Center>
    </Container>
  );
};

SignIn.pageTitle = 'Sign In';

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await unstable_getServerSession(req, res, authOptions);
  const providers = await getProviders();

  return {
    ...(session?.user
      ? {
          redirect: {
            permanent: false,
            destination: '/',
          },
        }
      : {}),
    props: { providers },
  };
};

export default SignIn;
