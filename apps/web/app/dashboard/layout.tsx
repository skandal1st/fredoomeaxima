'use client';

import { Shell } from '../../components/shell';

const NAV = [
  { href: '/dashboard', label: 'Обзор' },
  { href: '/dashboard/configs', label: 'VPN-конфиги' },
  { href: '/dashboard/billing', label: 'Подписка и оплата' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell nav={NAV} role="USER">
      {children}
    </Shell>
  );
}
