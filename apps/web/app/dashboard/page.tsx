'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { money, date } from '../../lib/format';
import { Badge, PageHeader, Spinner } from '../../components/ui';

interface Overview {
  subscription: {
    status: string;
    endsAt: string;
    tariff: { name: string; deviceLimit: number };
  } | null;
}

export default function DashboardOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api<Overview>('/me/overview'), api<any[]>('/tariffs')])
      .then(([ov, tf]) => {
        setData(ov);
        setTariffs(tf);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const sub = data?.subscription;

  return (
    <div>
      <PageHeader title="Overview" subtitle="Your subscription and quick actions" />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Subscription</h2>
          {sub ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{sub.tariff.name}</span>
                <Badge status={sub.status} />
              </div>
              <p className="text-sm text-slate-500">Renews / expires: {date(sub.endsAt)}</p>
              <p className="text-sm text-slate-500">Device limit: {sub.tariff.deviceLimit}</p>
              <Link href="/dashboard/configs" className="btn-primary mt-3 inline-flex">
                Manage VPN configs
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">No active subscription. Choose a plan to get started.</p>
              <Link href="/dashboard/billing" className="btn-primary inline-flex">
                View plans
              </Link>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Available plans</h2>
          <ul className="space-y-2">
            {tariffs.map((t) => (
              <li key={t.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    {t.durationDays} days · {t.deviceLimit} devices
                  </p>
                </div>
                <span className="font-semibold">{money(t.priceCents, t.currency)}</span>
              </li>
            ))}
            {tariffs.length === 0 && <p className="text-sm text-slate-400">No plans configured yet.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
