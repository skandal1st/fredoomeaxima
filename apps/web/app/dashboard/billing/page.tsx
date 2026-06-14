'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money, date } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td } from '../../../components/ui';

interface Tariff {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  deviceLimit: number;
}
interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  tariff?: { name: string };
}

export default function BillingPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = async () => {
    const [t, p] = await Promise.all([api<Tariff[]>('/tariffs'), api<Payment[]>('/payments/mine')]);
    setTariffs(t);
    setPayments(p);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const checkout = async (tariffId: string) => {
    setBusy(tariffId);
    try {
      const res = await api<{ confirmationUrl: string | null; settled: boolean }>(
        `/payments/checkout/${tariffId}`,
        { method: 'POST' },
      );
      if (res.confirmationUrl) {
        window.location.href = res.confirmationUrl;
      } else {
        // Mock provider settles immediately.
        await load();
      }
    } finally {
      setBusy('');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Billing" subtitle="Choose a plan and view your payment history" />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {tariffs.map((t) => (
          <div key={t.id} className="card flex flex-col">
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <p className="mt-1 text-3xl font-bold">{money(t.priceCents, t.currency)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t.durationDays} days · up to {t.deviceLimit} devices
            </p>
            <button className="btn-primary mt-4" disabled={busy === t.id} onClick={() => checkout(t.id)}>
              {busy === t.id ? 'Processing…' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment history</h2>
      <Table
        head={
          <>
            <Th>Date</Th>
            <Th>Plan</Th>
            <Th>Amount</Th>
            <Th>Status</Th>
          </>
        }
      >
        {payments.map((p) => (
          <tr key={p.id}>
            <Td>{date(p.createdAt)}</Td>
            <Td>{p.tariff?.name ?? '—'}</Td>
            <Td>{money(p.amountCents, p.currency)}</Td>
            <Td>
              <Badge status={p.status} />
            </Td>
          </tr>
        ))}
        {payments.length === 0 && (
          <tr>
            <Td>No payments yet.</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
          </tr>
        )}
      </Table>
    </div>
  );
}
