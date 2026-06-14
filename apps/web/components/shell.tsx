'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { Spinner } from './ui';

export interface NavItem {
  href: string;
  label: string;
}

export function Shell({
  nav,
  role,
  children,
}: {
  nav: NavItem[];
  role: 'USER' | 'ADMIN';
  children: ReactNode;
}) {
  const { me, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/login');
    else if (role === 'ADMIN' && me.role !== 'ADMIN') router.replace('/dashboard');
  }, [me, loading, role, router]);

  if (loading || !me) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5">
          <span className="text-xl font-bold text-brand-600">AximaVPN</span>
          {role === 'ADMIN' && <span className="ml-2 badge bg-slate-900 text-white">admin</span>}
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-5 py-4">
          <p className="truncate text-xs text-slate-400">{me.email}</p>
          <button onClick={logout} className="mt-2 text-sm text-slate-600 hover:text-red-600">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
