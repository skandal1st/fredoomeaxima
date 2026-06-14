'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { date } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td } from '../../../components/ui';

interface UserRow {
  id: string;
  email: string;
  status: string;
  role: string;
  createdAt: string;
}
interface Tariff {
  id: string;
  name: string;
}
interface UserCard {
  id: string;
  email: string;
  status: string;
  subscriptions: { id: string; status: string; endsAt: string; tariff: { name: string } }[];
  peers: { id: string; assignedIp: string; server: { name: string } }[];
  payments: { id: string; amountCents: number; currency: string; status: string }[];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [card, setCard] = useState<UserCard | null>(null);
  const [grantTariff, setGrantTariff] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadUsers = async (q = '') => {
    setUsers(await api<UserRow[]>(`/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`));
  };

  useEffect(() => {
    Promise.all([loadUsers(), api<Tariff[]>('/admin/tariffs').then(setTariffs)]).finally(() => setLoading(false));
  }, []);

  const openCard = async (id: string) => {
    const c = await api<UserCard>(`/admin/users/${id}`);
    setCard(c);
    setGrantTariff(tariffs[0]?.id ?? '');
  };

  const grant = async () => {
    if (!card || !grantTariff) return;
    await api(`/admin/users/${card.id}/subscription`, { method: 'POST', body: JSON.stringify({ tariffId: grantTariff }) });
    await openCard(card.id);
  };

  const toggleBlock = async (c: UserCard) => {
    const action = c.status === 'BLOCKED' ? 'unblock' : 'block';
    await api(`/admin/users/${c.id}/${action}`, { method: 'POST' });
    await Promise.all([openCard(c.id), loadUsers(search)]);
  };

  const deletePeer = async (peerId: string) => {
    await api(`/admin/peers/${peerId}`, { method: 'DELETE' });
    if (card) await openCard(card.id);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage accounts, subscriptions and peers" />

      <div className="mb-4 flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search by email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadUsers(search)}
        />
        <button className="btn-ghost" onClick={() => loadUsers(search)}>
          Search
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Table
          head={
            <>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
            </>
          }
        >
          {users.map((u) => (
            <tr key={u.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openCard(u.id)}>
              <Td>{u.email}</Td>
              <Td>
                <Badge status={u.status} />
              </Td>
              <Td>{date(u.createdAt)}</Td>
            </tr>
          ))}
        </Table>

        {card && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{card.email}</h2>
                <Badge status={card.status} />
              </div>
              <button className="btn-ghost" onClick={() => toggleBlock(card)}>
                {card.status === 'BLOCKED' ? 'Unblock' : 'Block'}
              </button>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Grant / extend subscription</h3>
              <div className="flex gap-2">
                <select className="input" value={grantTariff} onChange={(e) => setGrantTariff(e.target.value)}>
                  {tariffs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" onClick={grant}>
                  Grant
                </button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Subscriptions</h3>
              {card.subscriptions.length === 0 && <p className="text-sm text-slate-400">None</p>}
              {card.subscriptions.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-slate-100 py-1 text-sm">
                  <span>{s.tariff.name}</span>
                  <span className="text-slate-400">until {date(s.endsAt)}</span>
                  <Badge status={s.status} />
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Active peers</h3>
              {card.peers.length === 0 && <p className="text-sm text-slate-400">None</p>}
              {card.peers.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-slate-100 py-1 text-sm">
                  <span>
                    {p.server.name} · {p.assignedIp}
                  </span>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => deletePeer(p.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
