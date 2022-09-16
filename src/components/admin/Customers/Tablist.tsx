import { Title, Tabs } from '@mantine/core';
import { useState } from 'react';

enum TabItems {
  All = 'all users',
  Active = 'active users',
  Deactivated = 'deactivated users',
}

export const Tablist = () => {
  const [activeTab, setActiveTab] = useState<TabItems>(TabItems.All);
  return (
    <Tabs
      radius="xs"
      mt="lg"
      value={activeTab}
      onTabChange={(value: TabItems) => setActiveTab(value)}
    >
      <Tabs.List>
        <Tabs.Tab value={TabItems.All}>
          <Title order={5}>All Customers</Title>
        </Tabs.Tab>
        <Tabs.Tab value={TabItems.Active} disabled>
          <Title order={5}>Active Customers</Title>
        </Tabs.Tab>
        <Tabs.Tab value={TabItems.Deactivated} disabled>
          <Title order={5}>Deactivated Customers</Title>
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
};
