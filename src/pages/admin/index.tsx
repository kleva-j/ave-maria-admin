/* eslint-disable react/display-name */
import type { NextPage } from 'next';

import { AdminLayout } from 'components/admin/Layout';
import { ReactNode, Suspense } from 'react';

import dynamic from 'next/dynamic';

const DynamicDashboard = dynamic(
  () => import('components/admin/Dashboard').then((mod) => mod.Dashboard),
  { loading: () => <div>Loading here...</div> }
);

type AdminPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const AdminPage: AdminPageProps = () => {
  return (
    <AdminLayout>
      <Suspense fallback={`Loading...`}>
        <DynamicDashboard />
      </Suspense>
    </AdminLayout>
  );
};

AdminPage.Wrapper = (children) => <>{children}</>;

AdminPage.pageTitle = 'Dashboard (Admin)';
AdminPage.displayName = 'Dashboard';

export default AdminPage;
