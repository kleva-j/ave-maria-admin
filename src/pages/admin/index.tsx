/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { Title, Stack } from '@mantine/core';
import { ReactNode } from 'react';

import type { NextPage } from 'next';

type AdminPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const AdminPage: AdminPageProps = () => {
  return (
    <AdminLayout>
      <Stack>
        <Title>This is the Admin page</Title>
      </Stack>
    </AdminLayout>
  );
};

AdminPage.Wrapper = (children) => <>{children}</>;

AdminPage.pageTitle = 'Dashboard (Admin)';
AdminPage.displayName = 'Dashboard';

export default AdminPage;
