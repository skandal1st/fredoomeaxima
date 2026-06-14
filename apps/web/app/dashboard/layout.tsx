'use client';

import { Shell } from '../../components/shell';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/configs', label: 'VPN Configs' },
  { href: '/dashboard/billing', label: 'Billing' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell nav={NAV} role="USER">
      {children}
    </Shell>
  );
}
