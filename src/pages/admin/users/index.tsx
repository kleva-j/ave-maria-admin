/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { Text } from '@mantine/core';
import { ReactNode } from 'react';

import type { NextPage } from 'next';

type CustomersProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const CustomersPage: CustomersProps = () => {
  return (
    <AdminLayout>
      <Text>This is the Customers page</Text>
    </AdminLayout>
  );
};

CustomersPage.Wrapper = (children) => <>{children}</>;

CustomersPage.pageTitle = 'View users (Admin)';
CustomersPage.displayName = 'View users (Admin)';

export default CustomersPage;
