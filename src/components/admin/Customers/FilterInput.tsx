import { Autocomplete, Button, Group, Text } from '@mantine/core';
import { AiOutlineExport } from 'react-icons/ai';
import { IoFilter } from 'react-icons/io5';
import { TbSearch } from 'react-icons/tb';
import { useState } from 'react';

export const FilterInput = () => {
  const [value, setValue] = useState('');
  const data =
    value.trim().length > 0 && !value.includes('@')
      ? ['gmail.com', 'outlook.com', 'yahoo.com'].map(
          (provider) => `${value}@${provider}`,
        )
      : [];
  return (
    <Group
      my="sm"
      p="sm"
      sx={(theme) => ({
        display: 'flex',
        backgroundColor:
          theme.colorScheme === 'dark'
            ? theme.colors.dark[7]
            : theme.colors.gray[1],
      })}
    >
      <Autocomplete
        size="sm"
        radius="sm"
        data={data}
        value={value}
        icon={<TbSearch />}
        onChange={setValue}
        sx={{ flex: '1' }}
        placeholder="Search user ID, status, customers name ..."
      />
      <Button variant="default" leftIcon={<IoFilter />}>
        <Text size="sm">Filter</Text>
      </Button>
      <Button variant="default" leftIcon={<AiOutlineExport />}>
        Export
      </Button>
    </Group>
  );
};
