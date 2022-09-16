/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { ReactNode } from 'react';

import type { NextPage } from 'next';
import { UserList } from 'components/admin/Customers/UserList';

type CustomersProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const CustomersPage: CustomersProps = () => {
  return (
    <AdminLayout>
      <UserList />
    </AdminLayout>
  );
};

CustomersPage.Wrapper = (children) => <>{children}</>;

CustomersPage.pageTitle = 'View users (Admin)';
CustomersPage.displayName = 'View users (Admin)';

export default CustomersPage;
