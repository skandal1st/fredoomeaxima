'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { date } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td, Tr } from '../../../components/ui';

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
      <PageHeader title="Пользователи" subtitle="Аккаунты, подписки и конфиги" />

      <div className="mb-4 flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="Поиск по email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadUsers(search)}
        />
        <button className="btn-ghost" onClick={() => loadUsers(search)}>
          Найти
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Table
          head={
            <>
              <Th>Email</Th>
              <Th>Статус</Th>
              <Th>Регистрация</Th>
            </>
          }
        >
          {users.map((u) => (
            <Tr key={u.id} onClick={() => openCard(u.id)}>
              <Td>
                <span className="text-strong">{u.email}</span>
              </Td>
              <Td>
                <Badge status={u.status} />
              </Td>
              <Td>{date(u.createdAt)}</Td>
            </Tr>
          ))}
        </Table>

        {card && (
          <div className="card reveal space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-strong">{card.email}</h2>
                <div className="mt-1">
                  <Badge status={card.status} />
                </div>
              </div>
              <button className="btn-ghost" onClick={() => toggleBlock(card)}>
                {card.status === 'BLOCKED' ? 'Разблокировать' : 'Заблокировать'}
              </button>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Выдать / продлить подписку</h3>
              <div className="flex gap-2">
                <select className="input" value={grantTariff} onChange={(e) => setGrantTariff(e.target.value)}>
                  {tariffs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" onClick={grant}>
                  Выдать
                </button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Подписки</h3>
              {card.subscriptions.length === 0 && <p className="text-sm text-faint">Нет</p>}
              {card.subscriptions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 border-t py-2 text-sm">
                  <span className="text-strong">{s.tariff.name}</span>
                  <span className="text-faint">до {date(s.endsAt)}</span>
                  <Badge status={s.status} />
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Активные конфиги</h3>
              {card.peers.length === 0 && <p className="text-sm text-faint">Нет</p>}
              {card.peers.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-t py-2 text-sm">
                  <span className="text-dim">
                    {p.server.name} · <span className="mono">{p.assignedIp}</span>
                  </span>
                  <button className="text-xs hover:underline" style={{ color: '#ff8a8a' }} onClick={() => deletePeer(p.id)}>
                    Удалить
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
