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
      <aside
        className="sticky top-0 flex h-screen w-64 flex-col"
        style={{ borderRight: '1px solid var(--border)', background: 'rgba(8,11,17,0.6)', backdropFilter: 'blur(8px)' }}
      >
        <div className="px-6 py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <SignalMark />
            <span className="font-display text-lg font-bold tracking-tight text-strong">
              Axima<span className="text-accent">VPN</span>
            </span>
          </Link>
          {role === 'ADMIN' && (
            <span className="mt-2 inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
              панель администратора
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors"
                style={
                  active
                    ? { color: 'var(--text)', background: 'rgba(94,240,192,0.07)' }
                    : { color: 'var(--text-dim)' }
                }
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r"
                    style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
            <p className="truncate text-xs text-dim">{me.email}</p>
          </div>
          <button
            onClick={logout}
            className="mt-2.5 text-xs font-medium text-faint transition-colors hover:text-[#ff8a8a]"
          >
            Выйти из аккаунта
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-10 py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Minimal "signal/shield" brand glyph. */
function SignalMark() {
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-lg"
      style={{
        background: 'linear-gradient(160deg, rgba(94,240,192,0.25), rgba(94,240,192,0.05))',
        border: '1px solid rgba(94,240,192,0.35)',
        boxShadow: '0 0 18px -4px var(--accent-glow)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2 4 5.5v6c0 5 3.4 8.2 8 10.5 4.6-2.3 8-5.5 8-10.5v-6L12 2Z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.5 12.2l2.4 2.4 4.6-5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
