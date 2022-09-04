import {
  ThemeIconVariant,
  UnstyledButton,
  ThemeIcon,
  Text,
  Group,
} from '@mantine/core';
import { ReactNode } from 'react';

import Link from 'next/link';

type ButtonLinkProps = {
  href: string;
  label: string;
  icon: ReactNode;
  isActive?: boolean;
  variant?: ThemeIconVariant | undefined;
  onClick?: () => void;
};

export const ButtonLink = (props: ButtonLinkProps & Record<string, any>) => {
  const {
    href,
    label,
    icon: Icon,
    variant = 'light',
    isActive = false,
  } = props;

  return (
    <Link href={href} passHref>
      <UnstyledButton
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
                    ? theme.colors.dark[6]
                    : theme.colors.gray[0],
              }
            : {}),

          '&:hover': {
            backgroundColor:
              theme.colorScheme === 'dark'
                ? theme.colors.dark[8]
                : theme.colors.gray[2],
          },
        })}
      >
        <Group>
          <ThemeIcon variant={variant}>{Icon}</ThemeIcon>
          <Text size="sm">{label}</Text>
        </Group>
      </UnstyledButton>
    </Link>
  );
};
