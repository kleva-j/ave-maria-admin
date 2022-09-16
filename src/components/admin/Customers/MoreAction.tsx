import { TbMessageCircle, TbTrash, TbDots, TbEdit } from 'react-icons/tb';
import { Menu, Text, ThemeIcon } from '@mantine/core';

export const MoreAction = () => {
  return (
    <Menu position="bottom-end" transition="pop">
      <Menu.Target>
        <ThemeIcon
          variant="light"
          radius="xl"
          size="xs"
          style={{ cursor: 'pointer' }}
        >
          <TbDots />
        </ThemeIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Application</Menu.Label>
        <Menu.Item icon={<TbEdit size={14} />} py="5px">
          <Text size="xs">Edit Details</Text>
        </Menu.Item>
        <Menu.Item icon={<TbMessageCircle size={14} />} py="5px">
          <Text size="xs">Message</Text>
        </Menu.Item>
        <Menu.Divider />
        <Menu.Label>Danger zone</Menu.Label>
        <Menu.Item color="red" icon={<TbTrash size={14} />} py="5px">
          Delete account
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
