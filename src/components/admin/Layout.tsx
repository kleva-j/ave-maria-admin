import { Footer, Header, Sidebar } from 'components/layout';
import { AppShell } from '@mantine/core';
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
  const [opened, setOpened] = useState(false);

  return (
    <AppShell
      fixed
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="md"
      header={<Header opened={opened} setOpened={setOpened} />}
      navbar={<AdminNavbar opened={opened} />}
      footer={<Footer />}
      aside={<Sidebar />}
    >
      {isValidElement(children) && cloneElement(children, { opened })}
    </AppShell>
  );
};
