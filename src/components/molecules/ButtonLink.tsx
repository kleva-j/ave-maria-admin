import { IconType } from 'react-icons';
import {
  ThemeIconVariant,
  UnstyledButton,
  ThemeIcon,
  Text,
  Group,
} from '@mantine/core';

import Link from 'next/link';

type ButtonLinkProps = {
  href: string;
  text: string;
  Icon: IconType;
  variant?: ThemeIconVariant | undefined;
};

export const ButtonLink = (props: ButtonLinkProps) => {
  const { href, text, Icon, variant = 'light' } = props;

  return (
    <Link href={href} passHref>
      <UnstyledButton
        component="a"
        sx={(theme) => ({
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
        })}
      >
        <Group>
          <ThemeIcon variant={variant}>
            <Icon />
          </ThemeIcon>
          <Text size="sm">{text}</Text>
        </Group>
      </UnstyledButton>
    </Link>
  );
};
