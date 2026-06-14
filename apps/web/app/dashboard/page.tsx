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
      <PageHeader title="Обзор" subtitle="Ваша подписка и быстрые действия" />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card reveal">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">Подписка</h2>
          {sub ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-semibold text-strong">{sub.tariff.name}</span>
                <Badge status={sub.status} />
              </div>
              <div className="space-y-1.5 text-sm text-dim">
                <p>
                  Действует до: <span className="mono text-strong">{date(sub.endsAt)}</span>
                </p>
                <p>
                  Лимит устройств: <span className="text-strong">{sub.tariff.deviceLimit}</span>
                </p>
              </div>
              <Link href="/dashboard/configs" className="btn-primary mt-2 inline-flex">
                Управлять VPN-конфигами
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-dim">Активной подписки нет. Выберите тариф, чтобы начать.</p>
              <Link href="/dashboard/billing" className="btn-primary inline-flex">
                Выбрать тариф
              </Link>
            </div>
          )}
        </div>

        <div className="card reveal" style={{ animationDelay: '60ms' }}>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">Доступные тарифы</h2>
          <ul className="space-y-1">
            {tariffs.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between border-t py-3 first:border-t-0"
              >
                <div>
                  <p className="font-medium text-strong">{t.name}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    {t.durationDays} дн. · {t.deviceLimit} устройств
                  </p>
                </div>
                <span className="mono font-semibold text-accent">{money(t.priceCents, t.currency)}</span>
              </li>
            ))}
            {tariffs.length === 0 && <p className="text-sm text-faint">Тарифы ещё не настроены.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
