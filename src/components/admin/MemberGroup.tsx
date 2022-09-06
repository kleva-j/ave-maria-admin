import { Button, Group, Stack, Title, Text } from '@mantine/core';
import { AiOutlineDownload } from 'react-icons/ai';
import { MemberDetails } from './MemberDetails';

interface IMemberGroup {
  title: string;
  description: string;
  group: string;
  userList: any[];
  handleDownload: (e: string) => () => void;
  handleDelete: (e: string) => () => void;
  handleUpdate: (e: string) => () => void;
}

export const MemberGroup = ({
  title,
  description,
  group,
  userList,
  handleDownload,
  handleDelete,
  handleUpdate,
}: IMemberGroup) => {
  return (
    <Group position="apart" px="md" sx={{ margin: '1.8rem 0' }}>
      <Stack sx={{ maxWidth: 350 }}>
        <Title order={5}>{title}</Title>
        <Text
          size="sm"
          span
          inline
          sx={(theme) => ({
            lineHeight: '1.125rem',
            color: theme.colors.gray[7],
          })}
        >
          {description}
        </Text>
        <Group>
          <Button
            size="xs"
            rightIcon={<AiOutlineDownload size={20} />}
            onClick={handleDownload(group)}
          >
            Download CSV
          </Button>
          <Button size="xs" color="teal">
            Invite a new member
          </Button>
        </Group>
      </Stack>
      <MemberDetails
        userList={userList}
        handleDelete={handleDelete(group)}
        handleUpdate={handleUpdate(group)}
      />
    </Group>
  );
};
