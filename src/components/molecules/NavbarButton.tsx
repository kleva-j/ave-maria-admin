import { IconType } from 'react-icons';
import {
  ThemeIconVariant,
  UnstyledButton,
  ThemeIcon,
  Text,
  Group,
} from '@mantine/core';

type ButtonProps = {
  text: string;
  Icon: IconType;
  isActive?: boolean;
  onClick?: () => void;
  variant?: ThemeIconVariant | undefined;
};

export const NavbarButton = (props: ButtonProps) => {
  const { text, Icon, variant = 'light', isActive = false } = props;
  return (
    <UnstyledButton
      component="a"
      sx={(theme) => ({
        display: 'block',
        width: '100%',
        padding: theme.spacing.xs,
        borderRadius: theme.radius.sm,
        color:
          theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,
        ...(isActive
          ? {
              backgroundColor:
                theme.colorScheme === 'dark'
                  ? theme.colors.dark[8]
                  : theme.colors.gray[2],
            }
          : {}),

        '&:hover': {
          backgroundColor:
            theme.colorScheme === 'dark'
              ? theme.colors.dark[6]
              : theme.colors.gray[0],
        },
      })}
    >
      <Group>
        <ThemeIcon variant={variant}>
          <Icon />
        </ThemeIcon>
        <Text size="sm">{text}</Text>
      </Group>
    </UnstyledButton>
  );
};
