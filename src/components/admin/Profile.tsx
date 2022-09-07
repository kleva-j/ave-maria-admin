import {
  useMantineTheme,
  ActionIcon,
  Button,
  Avatar,
  Center,
  Group,
  Input,
  Title,
  Stack,
  Text,
  Tabs,
  Box,
} from '@mantine/core';
import { MdAlternateEmail, MdOutlineEmail } from 'react-icons/md';
import { useForm, zodResolver } from '@mantine/form';
import { useFileUpload } from 'hooks/FileUpload';
import { TbChevronDown } from 'react-icons/tb';
import { BiPencil } from 'react-icons/bi';
import { imgUrl } from 'helpers';
import { z } from 'zod';

const validate = zodResolver(
  z.object({
    firstname: z
      .string()
      .min(2, { message: 'Firstname should have at least 2 letters' }),
    lastname: z
      .string()
      .min(2, { message: 'Lastname should have at least 2 letters' }),
    email: z.string().email({ message: 'Invalid email' }),
  }),
);

export const Profile = () => {
  const form = useForm({
    initialValues: { email: '', firstname: '', lastname: '' },
    validate,
  });

  const { Component, imagePreview, onClick, loading } = useFileUpload({
    defaultImage: imgUrl,
  });

  const theme = useMantineTheme();
  const labelColor = theme.colors.dark[3];

  return (
    <Tabs.Panel value="profile" px="md" py="lg" sx={{ maxWidth: 850 }}>
      <form>
        <Group>
          <Stack sx={{ maxWidth: 450 }} spacing="lg">
            <Title order={4}>Personal Information</Title>
            <Text color="dimmed">
              Fill in your personal information below. You can update it anytime
              you want.
            </Text>

            <Input.Wrapper
              label="Email Address"
              sx={{ label: { color: labelColor, fontWeight: 'bold' } }}
            >
              <Input
                mt="xs"
                icon={<MdOutlineEmail />}
                rightSection={<MdAlternateEmail />}
                placeholder="username@domain.com"
                {...form.getInputProps('email')}
              />
            </Input.Wrapper>

            <Box>
              <Text size="sm" weight={600} color={labelColor}>
                Full name
              </Text>
              <Group grow mt="xs">
                <Input
                  required
                  placeholder="Firstname"
                  {...form.getInputProps('firstname')}
                />
                <Input
                  required
                  placeholder="Lastname"
                  {...form.getInputProps('lastname')}
                />
              </Group>
            </Box>

            <Input.Wrapper
              id="user-role"
              label="Role"
              sx={{ label: { fontWeight: 'bold', color: labelColor } }}
            >
              <Input
                mt="xs"
                id="user-role"
                component="select"
                defaultValue="user"
                rightSection={<TbChevronDown size={18} stroke="1.5" />}
                disabled
              >
                <option value="admin">Admin</option>
                <option value="user">Standard user</option>
              </Input>
            </Input.Wrapper>
          </Stack>
          <Box
            my="lg"
            sx={{ alignSelf: 'start', width: '100%', maxWidth: 350 }}
          >
            <Title order={5}>Profile photo</Title>
            <Center my="xl" sx={{ position: 'relative' }}>
              <Avatar size={120} radius={60} src={imagePreview} />
              <ActionIcon
                radius="xl"
                variant="filled"
                color="blue"
                size="lg"
                loading={loading}
                sx={{
                  position: 'absolute',
                  bottom: '-0.3125rem',
                  marginLeft: '4.25rem',
                }}
                onClick={onClick}
              >
                <BiPencil size={19} />
              </ActionIcon>
              {Component}
            </Center>
          </Box>
        </Group>
        <Group position="right">
          <Button disabled={form.isTouched() && !form.isDirty()}>
            Save Changes
          </Button>
        </Group>
      </form>
    </Tabs.Panel>
  );
};
