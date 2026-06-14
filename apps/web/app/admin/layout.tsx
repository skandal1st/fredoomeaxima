'use client';

import { Shell } from '../../components/shell';

const NAV = [
  { href: '/admin', label: 'Servers' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/tariffs', label: 'Tariffs' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/routes', label: 'Route Groups' },
  { href: '/admin/billing', label: 'Infra Billing' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell nav={NAV} role="ADMIN">
      {children}
    </Shell>
  );
}
