'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money, date } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td, Tr } from '../../../components/ui';

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
        await load();
      }
    } finally {
      setBusy('');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Подписка и оплата" subtitle="Выберите тариф и смотрите историю платежей" />

      <div className="mb-9 grid gap-4 md:grid-cols-3">
        {tariffs.map((t, i) => (
          <div key={t.id} className="card reveal flex flex-col" style={{ animationDelay: `${i * 50}ms` }}>
            <h3 className="font-display text-lg font-semibold text-strong">{t.name}</h3>
            <p className="mono mt-2 text-3xl font-bold text-strong">{money(t.priceCents, t.currency)}</p>
            <p className="mt-1.5 text-sm text-dim">
              {t.durationDays} дней · до {t.deviceLimit} устройств
            </p>
            <button className="btn-primary mt-5" disabled={busy === t.id} onClick={() => checkout(t.id)}>
              {busy === t.id ? 'Обработка…' : 'Оформить'}
            </button>
          </div>
        ))}
        {tariffs.length === 0 && <p className="text-sm text-faint">Тарифы ещё не настроены.</p>}
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">История платежей</h2>
      <Table
        head={
          <>
            <Th>Дата</Th>
            <Th>Тариф</Th>
            <Th>Сумма</Th>
            <Th>Статус</Th>
          </>
        }
      >
        {payments.map((p) => (
          <Tr key={p.id}>
            <Td>{date(p.createdAt)}</Td>
            <Td>{p.tariff?.name ?? '—'}</Td>
            <Td>
              <span className="mono text-strong">{money(p.amountCents, p.currency)}</span>
            </Td>
            <Td>
              <Badge status={p.status} />
            </Td>
          </Tr>
        ))}
        {payments.length === 0 && (
          <Tr>
            <Td>Платежей пока нет.</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
            <Td>{''}</Td>
          </Tr>
        )}
      </Table>
    </div>
  );
}
