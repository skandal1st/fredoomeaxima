'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money, date } from '../../../lib/format';
import { PageHeader, Spinner, Table, Th, Td } from '../../../components/ui';

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
      <PageHeader title="Infra Billing" subtitle="VPS spend vs revenue and upcoming renewals" />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {currencies.map((cur) => {
          const cost = data.monthlyCostByCurrency[cur] ?? 0;
          const revenue = data.revenueThisMonthByCurrency[cur] ?? 0;
          const margin = revenue - cost;
          return (
            <div key={cur} className="card">
              <h3 className="text-sm font-semibold uppercase text-slate-500">{cur}</h3>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly cost</span>
                  <span>{money(cost, cur)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Revenue (this month)</span>
                  <span>{money(revenue, cur)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
                  <span>Margin</span>
                  <span className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>{money(margin, cur)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {currencies.length === 0 && <p className="text-sm text-slate-400">No cost/revenue data yet.</p>}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming renewals</h2>
      <Table
        head={
          <>
            <Th>Server</Th>
            <Th>Country</Th>
            <Th>Provider</Th>
            <Th>Cost</Th>
            <Th>Next renewal</Th>
          </>
        }
      >
        {data.upcomingRenewals.map((r) => (
          <tr key={r.serverId}>
            <Td>{r.name}</Td>
            <Td>{r.country}</Td>
            <Td>{r.provider ?? '—'}</Td>
            <Td>{money(r.monthlyCostCents, r.costCurrency)}</Td>
            <Td>{date(r.nextRenewalAt)}</Td>
          </tr>
        ))}
        {data.upcomingRenewals.length === 0 && (
          <tr>
            <Td>No renewals scheduled.</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
          </tr>
        )}
      </Table>
    </div>
  );
}
