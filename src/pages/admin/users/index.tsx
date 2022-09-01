/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { Text } from '@mantine/core';
import { ReactNode } from 'react';

import type { NextPage } from 'next';

type ViewUsersProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const ViewUsersPage: ViewUsersProps = () => {
  return (
    <AdminLayout>
      <Text>This is the View Users page</Text>
    </AdminLayout>
  );
};

ViewUsersPage.Wrapper = (children) => <>{children}</>;

ViewUsersPage.pageTitle = 'View users (Admin)';
ViewUsersPage.displayName = 'View users (Admin)';

export default ViewUsersPage;
