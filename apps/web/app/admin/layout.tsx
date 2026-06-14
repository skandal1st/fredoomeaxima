'use client';

import { Shell } from '../../components/shell';

const NAV = [
  { href: '/admin', label: 'Серверы' },
  { href: '/admin/countries', label: 'Страны' },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/tariffs', label: 'Тарифы' },
  { href: '/admin/payments', label: 'Платежи' },
  { href: '/admin/routes', label: 'Маршруты' },
  { href: '/admin/billing', label: 'Расходы на инфраструктуру' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell nav={NAV} role="ADMIN">
      {children}
    </Shell>
  );
}
