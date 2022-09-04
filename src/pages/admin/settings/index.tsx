/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { Title, Stack } from '@mantine/core';
import { ReactNode } from 'react';

import type { NextPage } from 'next';

type SettingsPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const SettingsPage: SettingsPageProps = () => {
  return (
    <AdminLayout>
      <Stack>
        <Title>This is the Settings page</Title>
      </Stack>
    </AdminLayout>
  );
};

SettingsPage.Wrapper = (children) => <>{children}</>;

SettingsPage.pageTitle = 'Settings (Admin)';
SettingsPage.displayName = 'Settings';

export default SettingsPage;
