import { Autocomplete, Group, Stack, Tabs, Title } from '@mantine/core';
import { useState } from 'react';
import { FiSearch } from 'react-icons/fi';

import { Integrations } from './Integrations';
import { Members } from './Members';
import { Notification } from './Notification';
import { Permissions } from './Permissions';
import { Profile } from './Profile';

enum TabItems {
  Profile = 'Profile',
  Members = 'Members',
  Permissions = 'Permissions',
  Integrations = 'Integrations',
  Notifications = 'Notifications',
}

export const Settings = () => {
  const [activeTab, setActiveTab] = useState<TabItems>(TabItems.Profile);
  const [value, setValue] = useState('');
  const data =
    value.trim().length > 0 && !value.includes('@')
      ? ['gmail.com', 'outlook.com', 'yahoo.com'].map(
          (provider) => `${value}@${provider}`,
        )
      : [];

  return (
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
      <Tabs
        value={activeTab}
        onTabChange={(value: TabItems) => setActiveTab(value)}
        keepMounted={false}
      >
        <Tabs.List>
          <Tabs.Tab value="profile">Profile</Tabs.Tab>
          <Tabs.Tab value="members">Members</Tabs.Tab>
          <Tabs.Tab value="permissions">Permissions</Tabs.Tab>
          <Tabs.Tab value="notification">Notifications</Tabs.Tab>
          <Tabs.Tab value="integrations">Integrations</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Profile />
      <Members />
      <Permissions />
      <Notification />
      <Integrations />
    </Stack>
  );
};
