import { DateRangePickerValue, DateRangePicker } from '@mantine/dates';
import { Stack, Group, Text, Card } from '@mantine/core';
import { useState } from 'react';

export const SalesChart = () => {
  const [dateRange, setDateRange] = useState<DateRangePickerValue>([
    new Date(2022, 1, 1),
    new Date(Date.now()),
  ]);
  return (
    <Card radius="sm" sx={{ height: 360 }} withBorder>
      <Stack>
        <Group position="apart">
          <Text size="sm" weight={600}>
            Revenue over time by value
          </Text>
          <DateRangePicker
            size="sm"
            value={dateRange}
            onChange={setDateRange}
          />
        </Group>
      </Stack>
    </Card>
  );
};
