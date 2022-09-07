/* eslint-disable react/display-name */
import { Autocomplete, Title, Stack, Group, Tabs } from '@mantine/core';
import { Profile, Members, Integrations } from 'components/admin';
import { Permissions } from 'components/admin/Permissions';
import { AdminLayout } from 'components/admin/Layout';
import { useState, ReactNode } from 'react';
import { FiSearch } from 'react-icons/fi';

import type { NextPage } from 'next';
import { Notification } from 'components/admin/Notification';

type SettingsPageProps = NextPage & {
  pageTitle: string;
  Wrapper: (chilren: ReactNode) => JSX.Element;
};

const SettingsPage: SettingsPageProps = () => {
  const [value, setValue] = useState('');
  const data =
    value.trim().length > 0 && !value.includes('@')
      ? ['gmail.com', 'outlook.com', 'yahoo.com'].map(
          (provider) => `${value}@${provider}`,
        )
      : [];

  return (
    <AdminLayout>
      <Stack>
        <Group position="apart" my="md">
          <Title order={3}>Settings</Title>
          <Autocomplete
            size="xs"
            radius="sm"
            data={data}
            value={value}
            icon={<FiSearch />}
            onChange={setValue}
            placeholder="Search a user, settings..."
            sx={{ width: '100%', maxWidth: '15.625rem' }}
          />
        </Group>
        <Tabs defaultValue="profile" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="profile">Profile</Tabs.Tab>
            <Tabs.Tab value="members">Members</Tabs.Tab>
            <Tabs.Tab value="notification">Notifications</Tabs.Tab>
            <Tabs.Tab value="integrations">Integrations</Tabs.Tab>
            <Tabs.Tab value="permissions">Permissions</Tabs.Tab>
          </Tabs.List>
          <Profile />
          <Members />
          <Notification />
          <Integrations />
          <Permissions />
        </Tabs>
      </Stack>
    </AdminLayout>
  );
};

SettingsPage.Wrapper = (children) => <>{children}</>;

SettingsPage.pageTitle = 'Settings (Admin)';
SettingsPage.displayName = 'Settings';

export default SettingsPage;
