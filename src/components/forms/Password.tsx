import { getStrength, requirements } from 'helpers';
import { IoIosClose } from 'react-icons/io';
import { BiCheck } from 'react-icons/bi';
import { PasswordReqType } from 'types';
import { useState } from 'react';
import {
  PasswordInputProps,
  PasswordInput,
  Progress,
  Popover,
  Text,
  Box,
} from '@mantine/core';

const PasswordRequirement = ({ meets, label }: PasswordReqType) => (
  <Text
    sx={{ display: 'flex', alignItems: 'center' }}
    color={meets ? 'teal' : 'red'}
    size="sm"
    mt={7}
  >
    {meets ? <BiCheck size={14} /> : <IoIosClose size={14} />}{' '}
    <Box ml={10}>{label}</Box>
  </Text>
);

const Password = (props: PasswordInputProps) => {
  let { value } = props;
  value = value as string;
  const [popoverOpened, setPopoverOpened] = useState(false);
  const checks = requirements.map((requirement, index) => (
    <PasswordRequirement
      key={index}
      label={requirement.label}
      meets={requirement.re.test(value as string)}
    />
  ));
  const strength = getStrength(value);
  const color = strength === 100 ? 'teal' : strength > 50 ? 'yellow' : 'red';

  return (
    <Popover
      opened={popoverOpened}
      position="bottom"
      width="target"
      transition="pop"
    >
      <Popover.Target>
        <div
          onFocusCapture={() => setPopoverOpened(true)}
          onBlurCapture={() => setPopoverOpened(false)}
        >
          <PasswordInput
            required
            label="Password"
            description="Password must include at least one letter, number and special character"
            placeholder="Enter password"
            autoComplete="true"
            mt="md"
            {...props}
          />
        </div>
      </Popover.Target>
      <Popover.Dropdown>
        <Progress
          color={color}
          value={strength}
          size={5}
          style={{ marginBottom: 10 }}
        />
        <PasswordRequirement
          label="Includes at least 6 characters"
          meets={value.length > 5}
        />
        {checks}
      </Popover.Dropdown>
    </Popover>
  );
};

export default Password;
