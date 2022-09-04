import { Footer, Header, Sidebar } from 'components/layout';
import { AppShell, useMantineTheme } from '@mantine/core';
import {
  isValidElement,
  cloneElement,
  ReactElement,
  ReactNode,
  useState,
} from 'react';

import { AdminNavbar } from './Navbar';

type ReactText = string | number;
type ReactChild = ReactNode | ReactElement | ReactText;
type LayoutProps = { children: ReactChild };

export const AdminLayout = ({ children }: LayoutProps) => {
  const [opened, setOpened] = useState<boolean>(false);
  const theme = useMantineTheme();

  return (
    <AppShell
      fixed
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="md"
      header={<Header opened={opened} setOpened={setOpened} />}
      navbar={<AdminNavbar opened={opened} />}
      footer={<Footer />}
      aside={<Sidebar />}
      styles={{
        main: {
          backgroundColor:
            theme.colorScheme === 'dark'
              ? theme.colors.dark[8]
              : theme.colors.gray[0],
        },
      }}
    >
      {isValidElement(children) && cloneElement(children)}
    </AppShell>
  );
};
