/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { Title, Stack } from '@mantine/core';
import { ReactNode } from 'react';

import type { NextPage } from 'next';

type NotificationsPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const NotificationsPage: NotificationsPageProps = () => {
  return (
    <AdminLayout>
      <Stack>
        <Title>This is the Notifications page</Title>
      </Stack>
    </AdminLayout>
  );
};

NotificationsPage.Wrapper = (children) => <>{children}</>;

NotificationsPage.pageTitle = 'Notifications (Admin)';
NotificationsPage.displayName = 'Notifications';

export default NotificationsPage;
