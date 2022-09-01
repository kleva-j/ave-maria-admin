import { MdPayment, MdDashboard } from 'react-icons/md';
import { TbDeviceAnalytics } from 'react-icons/tb';
import { HiUsers } from 'react-icons/hi';

export const AdminRoutes = {
  dashboard: { icon: MdDashboard, href: '/admin', pathname: 'Dashboard' },
  users: { icon: HiUsers, href: '/admin/users', pathname: 'All Users' },
  contributions: {
    icon: MdPayment,
    href: '/admin/contributions',
    pathname: 'Contributions',
  },
  analytics: {
    icon: TbDeviceAnalytics,
    href: '/admin/analytics',
    pathname: 'Analytics',
  },
};

export const UserRoutes = {};
