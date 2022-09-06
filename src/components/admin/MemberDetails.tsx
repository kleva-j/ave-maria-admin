import {
  ActionIcon,
  Avatar,
  Table,
  Select,
  Group,
  Text,
  Box,
} from '@mantine/core';
import { RiDeleteBin6Line } from 'react-icons/ri';
import { TbChevronDown } from 'react-icons/tb';

interface IMemberDetails {
  userList: any[];
  handleDelete: () => void;
  handleUpdate: () => void;
}

export const MemberDetails = ({ userList }: IMemberDetails) => {
  return (
    <Box
      sx={(theme) => ({
        padding: '1rem 0.5rem',
        backgroundColor:
          theme.colorScheme === 'dark'
            ? theme.colors.dark[7]
            : theme.colors.gray[1],
      })}
    >
      <Table horizontalSpacing="lg">
        <thead>
          <tr>
            {['name', 'date added', 'last active'].map((item) => (
              <th key={item}>
                <Text color="dimmed" style={{ fontSize: '10px' }}>
                  {item.toUpperCase()}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {userList.map((item: any) => (
            <tr key={item.name}>
              <td>
                <Group>
                  <Avatar
                    src={
                      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=255&q=80'
                    }
                    radius="xl"
                  />
                  <Box sx={{ flex: 1 }}>
                    <Text size="sm" weight={500}>
                      {item?.name}
                    </Text>
                    <Text color="dimmed" size="xs">
                      {item?.email}
                    </Text>
                  </Box>
                </Group>
              </td>
              <td>
                <Text size="xs">
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </td>
              <td>
                <Text size="xs">
                  {new Date(item.last_active).toLocaleDateString()}
                </Text>
              </td>
              <td>
                <Select
                  sx={{ maxWidth: 120 }}
                  rightSection={<TbChevronDown size={14} />}
                  rightSectionWidth={30}
                  defaultValue="Standard user"
                  radius="xs"
                  size="xs"
                  styles={{ rightSection: { pointerEvents: 'none' } }}
                  data={['Administrator', 'Guest user', 'Standard user']}
                />
              </td>
              <td>
                <ActionIcon color="red">
                  <RiDeleteBin6Line />
                </ActionIcon>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Box>
  );
};
