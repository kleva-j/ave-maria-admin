import { formError, AuthState, AuthData, signupAuthSchema } from 'types';
import { TextInput, Button, Group } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { useRouter } from 'next/router';

import Password from 'components/forms/Password';

type Props = {
  handleSubmit: (e: AuthData & { name: string }) => any;
  setError: (error: formError) => void;
};

const initialValues = { name: '', email: '', password: '' };
const validate = zodResolver(signupAuthSchema);

export const SignupForm = ({ handleSubmit, setError }: Props) => {
  const router = useRouter();
  const form = useForm({ initialValues, validate });

  return (
    <form
      onSubmit={form.onSubmit(async (data) => {
        const { status, error, ok } = await handleSubmit({
          ...data,
          authType: AuthState.signup,
          redirect: false,
        });
        if (status !== '200' && !ok) {
          setError({
            message: `Check your credentials and try again.`,
            title: error,
            code: status,
          });
        }
        if (status === 200 && ok) router.push('/');
      })}
    >
      <TextInput
        mt="sm"
        required
        label="Name"
        placeholder="Enter your full name"
        {...form.getInputProps('name')}
      />
      <TextInput
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

// {
//   name: (value) => (value.length < 2 ? 'Name is too short' : null),
//   email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
//   password: (value) =>
//     /([0-9])([a-z])([A-Z])([$&+,:;=?@#|'<>.^*()%!-])/.test(value),
// },
