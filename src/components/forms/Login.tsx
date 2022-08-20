import { AuthData, AuthSchema, formError, AuthState } from 'types';
import { TextInput, Button, Group } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { useRouter } from 'next/router';

import Password from 'components/forms/Password';

type Props = {
  handleSubmit: (e: AuthData) => any;
  setError: (error: formError) => void;
};

const initialValues = { email: '', password: '' };
const validate = zodResolver(AuthSchema);

export const LoginForm = ({ handleSubmit, setError }: Props) => {
  const router = useRouter();
  const form = useForm({ initialValues, validate });

  return (
    <form
      onSubmit={form.onSubmit(async (data) => {
        const { status, ok, error } = await handleSubmit({
          ...data,
          authType: AuthState.login,
          redirect: false,
        });
        if (status === 401 && !ok) {
          setError({
            message: error ?? `You have entered the wrong credentials.`,
            title: 'Unauthorized',
            code: status,
          });
        }
        if (status === 200 && ok) router.push('/');
      })}
    >
      <TextInput
        name="textinput-email"
        mt="lg"
        required
        label="Email"
        placeholder="your@email.com"
        {...form.getInputProps('email')}
      />

      <Password {...form.getInputProps('password')} />

      <Group position="right" mt="lg">
        <Button type="submit">Submit</Button>
      </Group>
    </form>
  );
};
