import { formError, AuthSchema, AuthData, AuthState } from 'types';
import { Button, TextInput, Group, Modal } from '@mantine/core';
import { composeUrl, getSearchQuery } from 'helpers';
import { useForm, zodResolver } from '@mantine/form';
import { useRouter } from 'next/router';
import { useState } from 'react';

type formData = Omit<AuthData, 'password'>;

type Props = {
  isOpen: boolean;
  setOpened: (isOpen: boolean) => void;
  handleSubmit: (e: formData) => any;
  setError: (error: formError) => void;
};

const validate = zodResolver(AuthSchema.omit({ password: true }));

export const EmailModal = (props: Props) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { isOpen, handleSubmit, setOpened, setError } = props;
  const form = useForm({ initialValues: { email: '' }, validate });

  const handleFormSubmit = async (data: Pick<formData, 'email'>) => {
    setLoading(true);
    const result = await handleSubmit({
      ...data,
      redirect: false,
      authType: AuthState.login,
    });

    const { error, ok, status, url } = result;

    if (error) {
      setError({
        message: error ?? 'Error sending verification link to mail',
        title: 'Email Verification Error',
        code: status,
      });
    }
    if (!error && ok && status === 200) {
      router.push({
        pathname: '/auth/verify-request',
        query: getSearchQuery(
          composeUrl(url, { email: data.email }).searchParams,
        ),
      });
    }
    setLoading(false);
  };

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
      <form onSubmit={form.onSubmit(handleFormSubmit)}>
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
