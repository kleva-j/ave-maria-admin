import {
  useMantineTheme,
  Divider,
  Center,
  Button,
  Group,
  Title,
  Stack,
  Alert,
  Text,
  Tabs,
} from '@mantine/core';
import { FaFacebook, FaInstagram, FaTwitter } from 'react-icons/fa';
import { signIn, ClientSafeProvider } from 'next-auth/react';
import { AuthState, IconMaptype, formError } from 'types';
import { MdOutlineEmail } from 'react-icons/md';
import { SignInErrors } from 'utils/errors';
import { FcGoogle } from 'react-icons/fc';
import { BsGithub } from 'react-icons/bs';
import { GoAlert } from 'react-icons/go';
import { useRouter } from 'next/router';
import { isEmpty } from 'helpers';
import { useState } from 'react';

import { EmailModal } from './EmailAuth';
import { SignupForm } from './Signup';
import { LoginForm } from './Login';

type Props = {
  providers: Record<string, ClientSafeProvider>;
};

const nextAuthUrl = process.env.NEXT_PUBLIC_NEXTAUTH_URL ?? '';

const IconMap: IconMaptype = {
  google: <FcGoogle />,
  facebook: <FaFacebook />,
  github: <BsGithub />,
  instagram: <FaInstagram />,
  twitter: <FaTwitter />,
};

const AuthForm = ({ providers = {} }: Props) => {
  const theme = useMantineTheme();
  const { error: signInError } = useRouter().query;

  const [error, setError] = useState<null | formError>(
    signInError
      ? {
          title: 'SignIn Error',
          message: SignInErrors[signInError as string] ?? SignInErrors.default,
          code: 403,
        }
      : null,
  );
  const handleSubmit =
    (id: string) =>
    (signInOptions = {}) =>
      signIn(id, { callbackUrl: nextAuthUrl, ...signInOptions });

  const [isOpen, setOpened] = useState(false);

  return (
    <Stack style={{ maxWidth: '23.125rem' }}>
      {error && !isEmpty(error) && (
        <Alert
          icon={<GoAlert size={16} />}
          title={error.title}
          color="red"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error.message}
        </Alert>
      )}
      <Tabs radius="xs" defaultValue={AuthState.login}>
        <Tabs.List grow>
          <Tabs.Tab value={AuthState.signup}>
            <Title order={5}>Signup</Title>
          </Tabs.Tab>
          <Tabs.Tab value={AuthState.login}>
            <Title order={5}>Login</Title>
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value={AuthState.signup} pt="xs">
          <SignupForm
            handleSubmit={handleSubmit('credentials')}
            setError={setError}
          />
        </Tabs.Panel>
        <Tabs.Panel value={AuthState.login} pt="xs">
          <LoginForm
            handleSubmit={handleSubmit('credentials')}
            setError={setError}
          />
        </Tabs.Panel>
      </Tabs>

      <Divider my="xs" label="OR" labelPosition="center" />

      <EmailModal
        isOpen={isOpen}
        setOpened={setOpened}
        handleSubmit={handleSubmit('email')}
        setError={setError}
      />

      <Group position="apart" grow>
        {Object.values(providers)
          .filter(({ id }) => !['email', 'credentials'].includes(id))
          .map(({ id, name }) => (
            <Button
              size="sm"
              variant="white"
              style={{ border: '1px solid', borderColor: theme.colors.gray[4] }}
              color="dark"
              key={name}
              leftIcon={IconMap[id]}
              onClick={handleSubmit(id)}
            >
              <Center>
                <Text>{name}</Text>
              </Center>
            </Button>
          ))}
        <Button
          size="sm"
          variant="white"
          color="dark"
          style={{ border: '1px solid', borderColor: theme.colors.gray[4] }}
          leftIcon={<MdOutlineEmail />}
          onClick={() => setOpened(true)}
        >
          <Center>
            <Text>Email</Text>
          </Center>
        </Button>
      </Group>
    </Stack>
  );
};

export default AuthForm;
