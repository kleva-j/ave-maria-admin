import { NavbarButton } from 'components/molecules/NavbarButton';
import { UserCapsule } from 'components/molecules/UserCapsule';
import { MediaQuery, Navbar, Stack } from '@mantine/core';
import { IoMdExit } from 'react-icons/io';
import { signOut } from 'next-auth/react';
import { AdminRoutes } from 'lib/routes';
import { useRouter } from 'next/router';

export const AdminNavbar = (props: { opened: boolean }) => {
  const { opened } = props;
  const { asPath } = useRouter();
  const path = asPath.split('/').slice(-1)[0];

  return (
    <Navbar
      width={{ sm: 220, lg: 300 }}
      hiddenBreakpoint="sm"
      hidden={!opened}
      p="sm"
    >
      <Navbar.Section grow mt="xs">
        <Stack>
          {Object.values(AdminRoutes).map(
            ({ Component, icon: Icon, ...route }) => (
              <Component
                key={route.href}
                href={route.href}
                icon={<Icon />}
                label={route.pathname}
                isActive={path === route.matcher}
              />
            ),
          )}
        </Stack>
      </Navbar.Section>
      <MediaQuery largerThan="sm" styles={{ display: 'none' }}>
        <Navbar.Section>
          <NavbarButton
            Icon={IoMdExit}
            onClick={() => signOut()}
            text="Log out"
          ></NavbarButton>
        </Navbar.Section>
      </MediaQuery>
      <Navbar.Section>
        <UserCapsule />
      </Navbar.Section>
    </Navbar>
  );
};
