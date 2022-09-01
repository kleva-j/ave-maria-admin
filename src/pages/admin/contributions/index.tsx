/* eslint-disable react/display-name */
import { AdminLayout } from 'components/admin/Layout';
import { Text } from '@mantine/core';
import { ReactNode } from 'react';

import type { NextPage } from 'next';

type ContributionsProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const ContributionsPage: ContributionsProps = () => {
  return (
    <AdminLayout>
      <Text>This is the Contributions page</Text>
    </AdminLayout>
  );
};

ContributionsPage.Wrapper = (children) => <>{children}</>;

ContributionsPage.pageTitle = 'Contributions (Admin)';
ContributionsPage.displayName = 'Contributions';

export default ContributionsPage;
