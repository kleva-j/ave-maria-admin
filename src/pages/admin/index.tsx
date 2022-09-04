/* eslint-disable react/display-name */
import { SimpleGrid, Title, Stack, Select, Group, Grid } from '@mantine/core';
import { currencyFormatter, numberFormater } from 'helpers';
import { SalesChart } from 'components/admin/SalesChart';
import { StatsCard } from 'components/admin/StatsCard';
import { AdminLayout } from 'components/admin/Layout';
import { CardRing } from 'components/admin/RingCard';
import { MdOutlineDateRange } from 'react-icons/md';
import { BsCurrencyExchange } from 'react-icons/bs';
import { BiGitPullRequest } from 'react-icons/bi';
import { useSession } from 'next-auth/react';
import { ReactNode, useState } from 'react';
import { AiFillEye } from 'react-icons/ai';
import { HiUsers } from 'react-icons/hi';
import type { NextPage } from 'next';

type AdminPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const AdminPage: AdminPageProps = () => {
  const { data } = useSession();
  const firstname = data?.user.name?.split(' ')[0];
  const [value, setValue] = useState<string>('today');
  return (
    <AdminLayout>
      <Stack>
        <Group my="md" position="apart">
          <Title order={3}>Welcome back, {firstname}</Title>
          <Select
            placeholder="Pick one"
            value={value}
            data={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'this week', label: 'This Week' },
              { value: 'this month', label: 'This Month' },
              { value: 'this year', label: 'This Year' },
            ]}
            icon={<MdOutlineDateRange />}
            sx={() => ({ maxWidth: 142 })}
            onChange={(value: string) => setValue(value)}
          ></Select>
        </Group>

        <SimpleGrid
          spacing={'md'}
          cols={4}
          breakpoints={[
            { maxWidth: 1328, cols: 2, spacing: 'sm' },
            { maxWidth: 480, cols: 1, spacing: 'sm' },
          ]}
        >
          <StatsCard
            icon={<HiUsers />}
            statLabel="Total Customers"
            statNumber={numberFormater(8246)}
          />
          <StatsCard
            statLabel="Total Revenue"
            icon={<BsCurrencyExchange />}
            statNumber={currencyFormatter(82469)}
          />
          <StatsCard
            icon={<AiFillEye />}
            statLabel="Total Viewers"
            statNumber={numberFormater(89)}
          />
          <StatsCard
            statLabel="Total Requests"
            icon={<BiGitPullRequest />}
            statNumber={numberFormater(44)}
          />
        </SimpleGrid>
        <Grid gutter="lg">
          <Grid.Col md={12} xl={9}>
            <SalesChart />
          </Grid.Col>
          <Grid.Col md={6} xl={3}>
            <CardRing />
          </Grid.Col>
        </Grid>
      </Stack>
    </AdminLayout>
  );
};

AdminPage.Wrapper = (children) => <>{children}</>;

AdminPage.pageTitle = 'Dashboard (Admin)';
AdminPage.displayName = 'Dashboard';

export default AdminPage;
