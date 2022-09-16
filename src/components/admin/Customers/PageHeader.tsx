import { Button, Group, Title, Menu, Text } from '@mantine/core';
import {
  TbArrowsLeftRight,
  TbMessageCircle,
  TbSettings,
  TbSearch,
  TbPhoto,
  TbTrash,
  TbDots,
} from 'react-icons/tb';

export const PageHeader = () => {
  return (
    <>
      <Group mt="md" position="apart">
        <Title order={3}>Customers</Title>
        <Group spacing="sm">
          <Button variant="default" size="xs" radius="sm" compact>
            Setup Details
          </Button>
          <Button variant="default" size="xs" radius="sm" compact>
            Other info
          </Button>
          <Menu position="bottom-end" transition="pop">
            <Menu.Target>
              <Button variant="default" size="xs" radius="sm" compact>
                <TbDots />
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Application</Menu.Label>
              <Menu.Item icon={<TbSettings size={14} />}>Settings</Menu.Item>
              <Menu.Item icon={<TbMessageCircle size={14} />}>
                Messages
              </Menu.Item>
              <Menu.Item icon={<TbPhoto size={14} />}>Gallery</Menu.Item>
              <Menu.Item
                icon={<TbSearch size={14} />}
                rightSection={
                  <Text size="xs" color="dimmed">
                    ⌘K
                  </Text>
                }
              >
                Search
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Danger zone</Menu.Label>
              <Menu.Item icon={<TbArrowsLeftRight size={14} />}>
                Transfer my data
              </Menu.Item>
              <Menu.Item color="red" icon={<TbTrash size={14} />}>
                Delete my account
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      <Text size="sm" color="dimmed" sx={{ maxWidth: 900 }}>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Deleniti
        ratione veritatis blanditiis. Consequatur, rerum? Necessitatibus porro a
        dicta non quasi laborum aperiam. Facere laborum ea eaque corporis cum
        sequi officia.
      </Text>
    </>
  );
};
