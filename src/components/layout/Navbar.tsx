import {
  UnstyledButton,
  ThemeIcon,
  Navbar,
  Group,
  Text,
  Stack,
} from '@mantine/core';
import { useSession } from 'next-auth/react';
import { MdAdminPanelSettings } from 'react-icons/md';

import Link from 'next/link';

export const PageNavbar = (props: { opened: boolean }) => {
  const { opened } = props;
  const { data } = useSession();

  return (
    <Navbar
      p="md"
      hiddenBreakpoint="sm"
      hidden={!opened}
      width={{ sm: 200, lg: 300 }}
    >
      <Navbar.Section grow mt="xs">
        <Stack>
          {data?.user?.role === 'admin' && (
            <Link href={`/admin`} passHref>
              <UnstyledButton
                component="a"
                sx={(theme) => ({
                  display: 'block',
                  width: '100%',
                  padding: theme.spacing.xs,
                  borderRadius: theme.radius.sm,
                  color:
                    theme.colorScheme === 'dark'
                      ? theme.colors.dark[0]
                      : theme.black,

                  '&:hover': {
                    backgroundColor:
                      theme.colorScheme === 'dark'
                        ? theme.colors.dark[6]
                        : theme.colors.gray[0],
                  },
                })}
              >
                <Group>
                  <ThemeIcon color="blue" variant="light">
                    <MdAdminPanelSettings />
                  </ThemeIcon>
                  <Text size="sm">Admin Page</Text>
                </Group>
              </UnstyledButton>
            </Link>
          )}
        </Stack>
      </Navbar.Section>
    </Navbar>
  );
};

/* <UserCapsule /> */
