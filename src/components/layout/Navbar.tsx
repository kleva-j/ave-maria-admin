import { Navbar, Text } from '@mantine/core';

export const PageNavbar = (props: { opened: boolean }) => {
  const { opened } = props;
  return (
    <Navbar
      p="md"
      hiddenBreakpoint="sm"
      hidden={!opened}
      width={{ sm: 200, lg: 300 }}
    >
      <Navbar.Section grow mt="xs">
        <Text>Application navbar</Text>
      </Navbar.Section>
    </Navbar>
  );
};

{
  /* <UserCapsule /> */
}
