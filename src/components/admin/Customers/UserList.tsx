import { Stack } from '@mantine/core';
import { trpc } from 'utils/trpc';

import { FilterInput } from './FilterInput';
import { PageHeader } from './PageHeader';
import { TableComponent } from './Table';
import { Tablist } from './Tablist';

export const UserList = () => {
  const { data: users } = trpc.useQuery(['user.all', {}], {
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return (
    <Stack>
      <PageHeader />
      <Tablist />
      <FilterInput />
      <TableComponent userList={users?.users} />
    </Stack>
  );
};
