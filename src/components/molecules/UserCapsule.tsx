import {
  useMantineTheme,
  UnstyledButton,
  Group,
  Avatar,
  Text,
  Box,
} from '@mantine/core';
import { useSession } from 'next-auth/react';

export const UserCapsule = () => {
  const theme = useMantineTheme();
  const { data } = useSession();
  const user = data?.user;

  return (
    <Box
      sx={{
        paddingTop: theme.spacing.sm,
        borderTop: `1px solid ${
          theme.colorScheme === 'dark'
            ? theme.colors.dark[4]
            : theme.colors.gray[2]
        }`,
      }}
    >
      <UnstyledButton
        sx={{
          display: 'block',
          width: '100%',
          padding: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          color:
            theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,

          '&:hover': {
            backgroundColor:
              theme.colorScheme === 'dark'
                ? theme.colors.dark[6]
                : theme.colors.gray[0],
          },
        }}
      >
        <Group>
          <Avatar
            src={
              'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=255&q=80'
            }
            radius="xl"
          />
          <Box sx={{ flex: 1 }}>
            <Text size="sm" weight={500}>
              {user?.name}
            </Text>
            <Text color="dimmed" size="xs">
              {user?.email}
            </Text>
          </Box>
        </Group>
      </UnstyledButton>
    </Box>
  );
};
