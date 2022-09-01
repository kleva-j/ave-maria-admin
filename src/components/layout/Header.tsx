import { BsMoonStars } from 'react-icons/bs';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { FiSun } from 'react-icons/fi';

import {
  useMantineColorScheme,
  useMantineTheme,
  ActionIcon,
  MediaQuery,
  Container,
  Header,
  Button,
  Burger,
  Group,
  Title,
} from '@mantine/core';
import Link from 'next/link';

type Props = {
  opened: boolean;
  setOpened: (value: boolean) => void;
};

const callbackUrl = process.env.NEXT_PUBLIC_NEXTAUTH_URL;

const handleSignOut = () => signOut();

export const PageHeader = ({ opened, setOpened }: Props) => {
  const { status } = useSession();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const handleOpen = (value: boolean) => !value;
  const dark = colorScheme === 'dark';

  const isLoggedIn = status === 'authenticated';

  return (
    <Header height={70} p="md">
      <Container size="xl">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <MediaQuery largerThan="sm" styles={{ display: 'none' }}>
            <Burger
              opened={opened}
              onClick={() => setOpened(handleOpen(opened))}
              size="sm"
              color={theme.colors.gray[6]}
              mr="xl"
            />
          </MediaQuery>

          <Group position="apart" sx={{ width: '100%' }}>
            <Title order={3}>Ave Maria</Title>

            <MediaQuery smallerThan="sm" styles={{ display: 'none' }}>
              <Group>
                {isLoggedIn && (
                  <ActionIcon
                    variant="outline"
                    color={dark ? 'yellow' : 'blue'}
                    onClick={() => toggleColorScheme()}
                    title="Toggle color scheme"
                  >
                    {dark ? <FiSun size={18} /> : <BsMoonStars size={18} />}
                  </ActionIcon>
                )}

                {!isLoggedIn ? (
                  <Link
                    href={`/auth/signin?CallbackUrl=${callbackUrl}`}
                    passHref
                  >
                    <Button component="a" variant="subtle" id="sign-in-button">
                      Sign in
                    </Button>
                  </Link>
                ) : (
                  <Button variant="light" onClick={handleSignOut}>
                    Sign out
                  </Button>
                )}
              </Group>
            </MediaQuery>
          </Group>
        </div>
      </Container>
    </Header>
  );
};
