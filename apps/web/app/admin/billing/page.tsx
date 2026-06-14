'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money, date } from '../../../lib/format';
import { PageHeader, Spinner, Table, Th, Td, Tr } from '../../../components/ui';

interface Overview {
  monthlyCostByCurrency: Record<string, number>;
  revenueThisMonthByCurrency: Record<string, number>;
  upcomingRenewals: {
    serverId: string;
    name: string;
    country: string;
    provider?: string;
    monthlyCostCents: number;
    costCurrency: string;
    nextRenewalAt?: string;
  }[];
}

export default function AdminBillingPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Overview>('/admin/billing/overview')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <Spinner />;

  const currencies = Array.from(
    new Set([...Object.keys(data.monthlyCostByCurrency), ...Object.keys(data.revenueThisMonthByCurrency)]),
  );

  return (
    <div>
      <PageHeader title="Расходы на инфраструктуру" subtitle="Затраты на VPS, доход и предстоящие продления" />

      <div className="mb-7 grid gap-4 md:grid-cols-3">
        {currencies.map((cur, i) => {
          const cost = data.monthlyCostByCurrency[cur] ?? 0;
          const revenue = data.revenueThisMonthByCurrency[cur] ?? 0;
          const margin = revenue - cost;
          return (
            <div key={cur} className="card reveal" style={{ animationDelay: `${i * 50}ms` }}>
              <h3 className="mono text-sm font-semibold uppercase tracking-wider text-faint">{cur}</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dim">Расходы в месяц</span>
                  <span className="mono text-strong">{money(cost, cur)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Доход (этот месяц)</span>
                  <span className="mono text-strong">{money(revenue, cur)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span className="text-strong">Маржа</span>
                  <span className="mono" style={{ color: margin >= 0 ? 'var(--accent)' : '#ff8a8a' }}>
                    {money(margin, cur)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {currencies.length === 0 && <p className="text-sm text-faint">Данных по расходам/доходу пока нет.</p>}
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">Предстоящие продления</h2>
      <Table
        head={
          <>
            <Th>Сервер</Th>
            <Th>Страна</Th>
            <Th>Провайдер</Th>
            <Th>Стоимость</Th>
            <Th>Следующее продление</Th>
          </>
        }
      >
        {data.upcomingRenewals.map((r) => (
          <Tr key={r.serverId}>
            <Td>
              <span className="text-strong">{r.name}</span>
            </Td>
            <Td>{r.country}</Td>
            <Td>{r.provider ?? '—'}</Td>
            <Td>
              <span className="mono">{money(r.monthlyCostCents, r.costCurrency)}</span>
            </Td>
            <Td>{date(r.nextRenewalAt)}</Td>
          </Tr>
        ))}
        {data.upcomingRenewals.length === 0 && (
          <Tr>
            <Td>Продлений не запланировано.</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
          </Tr>
        )}
      </Table>
    </div>
  );
}
