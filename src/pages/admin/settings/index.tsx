/* eslint-disable react/display-name */
import type { NextPage } from 'next';

import { AdminLayout } from 'components/admin/Layout';
import { ReactNode, Suspense } from 'react';

import dynamic from 'next/dynamic';

const DynamicSettings = dynamic(
  () => import('components/admin/Settings').then((mod) => mod.Settings),
  { loading: () => <div>Loading here...</div> },
);

type SettingsPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const SettingsPage: SettingsPageProps = () => {
  return (
    <AdminLayout>
      <Suspense>
        <DynamicSettings />
      </Suspense>
    </AdminLayout>
  );
};

SettingsPage.Wrapper = (children) => <>{children}</>;

SettingsPage.pageTitle = 'Settings (Admin)';
SettingsPage.displayName = 'Settings';

export default SettingsPage;
