import {
  Divider,
  Switch,
  Group,
  Stack,
  Title,
  Card,
  Text,
  Tabs,
} from '@mantine/core';
import { notificationConfig as config } from 'utils/data';
import { Fragment } from 'react';

export const Notification = () => {
  return (
    <Tabs.Panel value="notification" sx={{ maxWidth: 500 }} px="md" py="lg">
      <Stack>
        <Title order={5}>Notification settings</Title>
        <Text size="sm" color="dimmed">
          We may send you important notification about your account outside of
          your notification settings
        </Text>
      </Stack>

      <Card
        p="lg"
        mt="sm"
        withBorder
        sx={(theme) => ({
          backgroundColor:
            theme.colorScheme === 'dark'
              ? theme.colors.dark[7]
              : theme.colors.gray[1],
        })}
      >
        <Stack>
          {config.map(({ title, desc, value }, index) => (
            <Fragment key={title}>
              <Group sx={{ maxWidth: 450 }} position="apart">
                <Stack sx={{ maxWidth: 300 }}>
                  <Title order={6}>{title}</Title>
                  <Text size="sm">{desc}</Text>
                </Stack>
                <Stack>
                  <Switch size="xs" checked={!!value[0]} label="Push" />
                  <Switch size="xs" checked={!!value[1]} label="Email" />
                  <Switch size="xs" checked={!!value[2]} label="SMS" />
                </Stack>
              </Group>
              {index !== config.length - 1 && <Divider />}
            </Fragment>
          ))}
        </Stack>
      </Card>
    </Tabs.Panel>
  );
};
