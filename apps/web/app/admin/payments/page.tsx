'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money, date } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td } from '../../../components/ui';

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
      <PageHeader title="Payments" subtitle="All transactions; mark pending payments paid manually" />
      <Table
        head={
          <>
            <Th>Date</Th>
            <Th>User</Th>
            <Th>Plan</Th>
            <Th>Amount</Th>
            <Th>Provider</Th>
            <Th>Txn</Th>
            <Th>Status</Th>
            <Th>Action</Th>
          </>
        }
      >
        {payments.map((p) => (
          <tr key={p.id}>
            <Td>{date(p.createdAt)}</Td>
            <Td>{p.user.email}</Td>
            <Td>{p.tariff?.name ?? '—'}</Td>
            <Td>{money(p.amountCents, p.currency)}</Td>
            <Td>{p.provider}</Td>
            <Td>
              <span className="text-xs text-slate-400">{p.providerTxnId ?? '—'}</span>
            </Td>
            <Td>
              <Badge status={p.status} />
            </Td>
            <Td>
              {p.status === 'PENDING' && (
                <button className="text-xs text-brand-600 hover:underline" onClick={() => markPaid(p.id)}>
                  Mark paid
                </button>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
