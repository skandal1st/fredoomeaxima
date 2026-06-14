'use client';

import { ReactNode } from 'react';
import { statusColor, statusLabel } from '../lib/format';

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${statusColor(status)}`}>{statusLabel(status)}</span>;
}

export function Spinner() {
  return (
    <div
      className="h-6 w-6 animate-spin rounded-full"
      style={{ border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)' }}
    />
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="reveal mb-7 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-strong">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-dim">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm" style={{ color: '#ff8a8a' }}>{children}</p>;
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">{children}</th>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 text-sm text-dim">{children}</td>;
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="reveal overflow-hidden rounded-xl border" style={{ background: 'var(--bg-elev)' }}>
      <table className="min-w-full">
        <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Row helper with a hairline divider + hover. Use inside Table. */
export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`border-t transition-colors hover:bg-white/[0.02] ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </tr>
  );
}
