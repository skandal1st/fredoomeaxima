'use client';

import { ReactNode, useEffect, useState } from 'react';
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/login');
    else if (role === 'ADMIN' && me.role !== 'ADMIN') router.replace('/dashboard');
  }, [me, loading, role, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (loading || !me) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar: static on desktop, off-canvas drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col transition-transform duration-200 md:sticky md:top-0 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRight: '1px solid var(--border)', background: 'rgba(8,11,17,0.92)', backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <SignalMark />
            <span className="font-display text-lg font-bold tracking-tight text-strong">
              Axima<span className="text-accent">VPN</span>
            </span>
          </Link>
          <button className="text-faint hover:text-strong md:hidden" onClick={() => setOpen(false)} aria-label="Закрыть меню">
            <CloseIcon />
          </button>
        </div>
        {role === 'ADMIN' && (
          <span className="mx-6 mb-2 inline-block w-fit rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            панель администратора
          </span>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header
          className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 md:hidden"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(8,11,17,0.85)', backdropFilter: 'blur(10px)' }}
        >
          <button className="text-dim hover:text-strong" onClick={() => setOpen(true)} aria-label="Открыть меню">
            <MenuIcon />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <SignalMark small />
            <span className="font-display text-base font-bold tracking-tight text-strong">
              Axima<span className="text-accent">VPN</span>
            </span>
          </Link>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-10 md:py-9">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SignalMark({ small }: { small?: boolean }) {
  const s = small ? 7 : 8;
  return (
    <span
      className="grid place-items-center rounded-lg"
      style={{
        width: `${s * 4}px`,
        height: `${s * 4}px`,
        background: 'linear-gradient(160deg, rgba(94,240,192,0.25), rgba(94,240,192,0.05))',
        border: '1px solid rgba(94,240,192,0.35)',
        boxShadow: '0 0 18px -4px var(--accent-glow)',
      }}
    >
      <svg width={small ? 14 : 16} height={small ? 14 : 16} viewBox="0 0 24 24" fill="none">
        <path d="M12 2 4 5.5v6c0 5 3.4 8.2 8 10.5 4.6-2.3 8-5.5 8-10.5v-6L12 2Z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.5 12.2l2.4 2.4 4.6-5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
