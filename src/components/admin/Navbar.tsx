import { ButtonLink } from 'components/molecules/ButtonLink';
import { Navbar, Stack } from '@mantine/core';
import { AdminRoutes } from 'lib/routes';

export const AdminNavbar = (props: { opened: boolean }) => {
  const { opened } = props;

  return (
    <Navbar
      width={{ sm: 160, lg: 240 }}
      hiddenBreakpoint="sm"
      hidden={!opened}
      p="md"
    >
      <Navbar.Section grow mt="xs">
        <Stack>
          {Object.values(AdminRoutes).map((route) => (
            <ButtonLink
              key={route.href}
              href={route.href}
              Icon={route.icon}
              text={route.pathname}
            />
          ))}
        </Stack>
      </Navbar.Section>
    </Navbar>
  );
};
