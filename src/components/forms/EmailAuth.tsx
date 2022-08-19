import { formError, AuthSchema, AuthData, AuthState } from 'types';
import { Button, TextInput, Group, Modal } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { useState } from 'react';

type formData = Omit<AuthData, 'password'>;

type Props = {
  isOpen: boolean;
  setOpened: (isOpen: boolean) => void;
  handleSubmit: (e: formData) => any;
  setError?: (error: formError) => void;
};

const validate = zodResolver(AuthSchema.omit({ password: true }));

export const EmailModal = (props: Props) => {
  const [loading, setLoading] = useState(false);
  const { isOpen, handleSubmit, setOpened } = props;
  const form = useForm({ initialValues: { email: '' }, validate });

  return (
    <Modal
      size="xs"
      centered
      opened={isOpen}
      onClose={() => setOpened(false)}
      transition="fade"
      transitionDuration={600}
      transitionTimingFunction="ease"
    >
      <form
        onSubmit={form.onSubmit(async (data) => {
          setLoading(true);
          await handleSubmit({ ...data, authType: AuthState.login });
          setLoading(false);
        })}
      >
        <TextInput
          required
          label="Email"
          data-autofocus
          placeholder="your@email.com"
          {...form.getInputProps('email')}
        />

        <Group position="right" mt="md">
          <Button loading={loading} type="submit">
            Submit
          </Button>
        </Group>
      </form>
    </Modal>
  );
};
