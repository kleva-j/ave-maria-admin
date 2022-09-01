import { Footer, Header, Navbar } from 'components/layout';
import { AppShell, useMantineTheme } from '@mantine/core';
import { ReactNode, useState } from 'react';
import { useSession } from 'next-auth/react';

const Layout = (props: { children?: ReactNode }) => {
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);

  const { status } = useSession();

  return (
    <AppShell
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="md"
      styles={{
        main: {
          backgroundColor:
            theme.colorScheme === 'dark'
              ? theme.colors.dark[8]
              : theme.colors.gray[0],
        },
      }}
      fixed
      header={<Header opened={opened} setOpened={setOpened} />}
      footer={<Footer />}
      {...(status === 'authenticated' && {
        navbar: <Navbar opened={opened} />,
      })}
    >
      {props.children}
    </AppShell>
  );
};

export default Layout;
