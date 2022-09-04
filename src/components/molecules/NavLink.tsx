import {
  NavLink as NavItem,
  ThemeIconVariant,
  NavLinkProps,
  ThemeIcon,
} from '@mantine/core';

interface NavlinkProps extends NavLinkProps {
  key: string;
  href: string;
  isActive: boolean;
  themeIconVariant?: ThemeIconVariant;
}

export const NavLink = (props: NavlinkProps) => {
  const { isActive, icon, themeIconVariant } = props;
  return (
    <NavItem
      active={isActive}
      icon={<ThemeIcon variant={themeIconVariant}>{icon}</ThemeIcon>}
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
      {...props}
    />
  );
};
