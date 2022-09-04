/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { Text } from '@mantine/core';
import { ReactNode } from 'react';

import type { NextPage } from 'next';

type AnalyticsProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const AnalyticsPage: AnalyticsProps = () => {
  return (
    <AdminLayout>
      <Text>This is the Analytics page</Text>
    </AdminLayout>
  );
};

AnalyticsPage.Wrapper = (children) => <>{children}</>;

AnalyticsPage.pageTitle = 'Analytics (Admin)';
AnalyticsPage.displayName = 'Analytics (Admin)';

export default AnalyticsPage;
