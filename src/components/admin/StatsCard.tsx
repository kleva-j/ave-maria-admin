import { ReactNode } from 'react';
import {
  CardProps,
  ThemeIcon,
  Title,
  Stack,
  Group,
  Text,
  Card,
} from '@mantine/core';

type StatsCardProps = Omit<CardProps, 'children'> & {
  statLabel: string;
  icon: ReactNode;
  statNumber: string | number;
};

export const StatsCard = (props: StatsCardProps) => {
  const { statLabel, statNumber, icon, ...rest } = props;
  return (
    <Card p="lg" radius="sm" withBorder {...rest}>
      <Stack spacing="sm">
        <Group>
          <ThemeIcon radius="lg" variant="light">
            {icon}
          </ThemeIcon>
          <Text size="sm" weight="bold">
            {statLabel}
          </Text>
        </Group>
        <Title order={3}>{statNumber}</Title>
      </Stack>
    </Card>
  );
};
