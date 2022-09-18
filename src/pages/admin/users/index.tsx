/* eslint-disable react/display-name */
import type { NextPage } from 'next';

import { UserList } from 'components/admin/Customers/UserList';
import { AdminLayout } from 'components/admin/Layout';
import { ReactNode } from 'react';

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

// export const getServerSideProps: GetServerSideProps = async (context) => {
//   const { prefetchQuery, dehydrate } = await ssgHelpers(context);
//   await prefetchQuery('user.all', {});
//   return {
//     props: { trpcState: dehydrate() },
//   };
// };

CustomersPage.Wrapper = (children) => <>{children}</>;

CustomersPage.pageTitle = 'Customers (Admin)';
CustomersPage.displayName = 'Customers (Admin)';

export default CustomersPage;
