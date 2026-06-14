'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money, date } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td, Tr } from '../../../components/ui';

interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  providerTxnId?: string;
  createdAt: string;
  user: { email: string };
  tariff?: { name: string };
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => setPayments(await api<Payment[]>('/admin/payments'));
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const markPaid = async (id: string) => {
    await api(`/admin/payments/${id}/mark-paid`, { method: 'POST' });
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Платежи" subtitle="Все транзакции; платёж со статусом «Ожидание» можно отметить оплаченным вручную" />
      <Table
        head={
          <>
            <Th>Дата</Th>
            <Th>Пользователь</Th>
            <Th>Тариф</Th>
            <Th>Сумма</Th>
            <Th>Провайдер</Th>
            <Th>Транзакция</Th>
            <Th>Статус</Th>
            <Th>Действие</Th>
          </>
        }
      >
        {payments.map((p) => (
          <Tr key={p.id}>
            <Td>{date(p.createdAt)}</Td>
            <Td>
              <span className="text-strong">{p.user.email}</span>
            </Td>
            <Td>{p.tariff?.name ?? '—'}</Td>
            <Td>
              <span className="mono">{money(p.amountCents, p.currency)}</span>
            </Td>
            <Td>{p.provider}</Td>
            <Td>
              <span className="mono text-faint">{p.providerTxnId ?? '—'}</span>
            </Td>
            <Td>
              <Badge status={p.status} />
            </Td>
            <Td>
              {p.status === 'PENDING' && (
                <button className="text-xs text-accent hover:underline" onClick={() => markPaid(p.id)}>
                  Отметить оплаченным
                </button>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}
