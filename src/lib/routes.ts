import { ButtonLink } from 'components/molecules/ButtonLink';
import { MdPayment, MdDashboard } from 'react-icons/md';
import { AiOutlineNotification } from 'react-icons/ai';
import { IoSettingsOutline } from 'react-icons/io5';
import { TbDeviceAnalytics } from 'react-icons/tb';
import { HiUsers } from 'react-icons/hi';

export const AdminRoutes = {
  dashboard: {
    icon: MdDashboard,
    href: '/admin',
    pathname: 'Dashboard',
    matcher: 'admin',
    Component: ButtonLink,
    pageDescription: '',
  },
  users: {
    icon: HiUsers,
    href: '/admin/users',
    pathname: 'Customers',
    matcher: 'users',
    Component: ButtonLink,
    pageDescription: '',
  },
  contributions: {
    icon: MdPayment,
    href: '/admin/contributions',
    pathname: 'Contributions',
    matcher: 'contributions',
    Component: ButtonLink,
    pageDescription: '',
  },
  analytics: {
    icon: TbDeviceAnalytics,
    href: '/admin/analytics',
    pathname: 'Analytics',
    matcher: 'analytics',
    Component: ButtonLink,
    pageDescription: '',
  },
  notifications: {
    icon: AiOutlineNotification,
    href: '/admin/notifications',
    pathname: 'Notifications',
    matcher: 'notifications',
    Component: ButtonLink,
    pageDescription: '',
  },
  settings: {
    icon: IoSettingsOutline,
    href: '/admin/settings',
    pathname: 'Settings',
    matcher: 'settings',
    Component: ButtonLink,
    pageDescription: '',
  },
};

export const UserRoutes = {};
