/* eslint-disable react/display-name */
import type { NextPage } from 'next';

import { Dashboard } from 'components/admin/Dashboard';
import { AdminLayout } from 'components/admin/Layout';
import { ReactNode } from 'react';

type AdminPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const AdminPage: AdminPageProps = () => {
  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
};

AdminPage.Wrapper = (children) => <>{children}</>;

AdminPage.pageTitle = 'Dashboard (Admin)';
AdminPage.displayName = 'Dashboard';

export default AdminPage;
