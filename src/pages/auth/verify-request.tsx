import {
  useMantineTheme,
  Center,
  Button,
  Paper,
  Title,
  Stack,
  Group,
  Text,
} from '@mantine/core';
import { useMediaQuery, useTimeout, useInterval } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { AuthState } from 'types';
import { useState } from 'react';

import Image from 'next/future/image';
import Link from 'next/link';

import img from '../../../public/images/mailbox.png';

const VerifyRequest = () => {
  const theme = useMantineTheme();
  const { query, push } = useRouter();
  const { provider = 'email', type = 'email', email } = query;

  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const timeout = useTimeout(() => {
    setTouched(false);
    interval.stop();
    setSeconds(60);
  }, 60000);
  const interval = useInterval(() => setSeconds((s) => s - 1), 1000);

  if (!provider || !type || !email) push('/');

  const handleResendEmail = async () => {
    setLoading(true);
    const { ok, error }: any = await signIn('email', {
      email,
      redirect: false,
      authType: AuthState.login,
    });
    if (!ok)
      showNotification({
        title: `Error resending email`,
        message: error,
        autoClose: false,
      });
    setLoading(false);
    setTouched(true);
    timeout.start();
    interval.start();
  };

  const matches = useMediaQuery('(min-width: 456px)', true);
  return provider === 'email' && email ? (
    <Center sx={{ height: '100vh', backgroundColor: theme.colors.violet[8] }}>
      <Paper
        withBorder
        shadow="xs"
        py="xl"
        radius="md"
        px="md"
        style={{ width: '100%', maxWidth: '700px' }}
        mx="md"
        sx={{ backgroundColor: theme.white, color: theme.black }}
      >
        <Center>
          <Stack>
            {matches ? (
              <Title order={3} align="center">
                Verify your email address
              </Title>
            ) : (
              <Title order={4} align="center">
                Verify your email address
              </Title>
            )}
            <Text size="sm" align="center">
              You will need to verify your email to complete registration.
            </Text>
            <Image
              src={img}
              priority
              style={{ maxWidth: '70%', height: 'auto', margin: 'auto' }}
            />
            <Text
              size="sm"
              align="center"
              sx={{ maxWidth: '600px', margin: 'auto' }}
            >
              An email has been sent to{' '}
              <Text sx={{ display: 'inline', fontWeight: 600 }}>{email}</Text>{' '}
              with a link to verify your account. If you have not received the
              email after a few minutes, please check your spam folder.
            </Text>

            <Group
              my="5rem"
              position="center"
              spacing={matches ? 'xl' : 'sm'}
              style={{ margin: 'auto' }}
            >
              <Button
                onClick={handleResendEmail}
                loading={loading}
                disabled={touched ? true : false}
              >
                {touched ? `Wait (${seconds}) seconds` : 'Resend Email'}
              </Button>
              <Link href={`/`} passHref>
                <Button component="a" variant="subtle">
                  Back to Homepage
                </Button>
              </Link>
            </Group>
          </Stack>
        </Center>
      </Paper>
    </Center>
  ) : null;
};

VerifyRequest.pageTitle = 'Verify Email';

export default VerifyRequest;
