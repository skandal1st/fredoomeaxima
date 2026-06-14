'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { PageHeader, Spinner, Table, Th, Td, Tr, ErrorText } from '../../../components/ui';

interface Country {
  id: string;
  code: string;
  name: string;
  flagEmoji?: string | null;
  _count: { servers: number; tariffs: number };
}

const EMPTY = { code: '', name: '', flagEmoji: '' };

export default function AdminCountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY });
  const [rowError, setRowError] = useState('');

  const load = async () => {
    setCountries(await api<Country[]>('/admin/countries'));
  };
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/countries', {
        method: 'POST',
        body: JSON.stringify({ code: form.code, name: form.name, flagEmoji: form.flagEmoji || undefined }),
      });
      setForm({ ...EMPTY });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEdit = (c: Country) => {
    setRowError('');
    setEditId(c.id);
    setEditForm({ code: c.code, name: c.name, flagEmoji: c.flagEmoji ?? '' });
  };

  const saveEdit = async (id: string) => {
    setRowError('');
    try {
      await api(`/admin/countries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ code: editForm.code, name: editForm.name, flagEmoji: editForm.flagEmoji || undefined }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setRowError((err as Error).message);
    }
  };

  const remove = async (c: Country) => {
    setRowError('');
    if (!confirm(`Удалить страну «${c.name}»?`)) return;
    try {
      await api(`/admin/countries/${c.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setRowError((err as Error).message);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Страны" subtitle="Каталог стран VPN — используется при добавлении серверов и тарифов" />

      <div className="card reveal mb-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">Добавить страну</h2>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
          <input
            className="input"
            placeholder="Код (напр. FR)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            maxLength={2}
            required
          />
          <input
            className="input"
            placeholder="Название"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="Флаг (эмодзи)"
            value={form.flagEmoji}
            onChange={(e) => setForm({ ...form, flagEmoji: e.target.value })}
          />
          <button className="btn-primary">Добавить</button>
          <div className="md:col-span-4">
            <ErrorText>{error}</ErrorText>
          </div>
        </form>
      </div>

      {rowError && (
        <div className="mb-4">
          <ErrorText>{rowError}</ErrorText>
        </div>
      )}

      <Table
        head={
          <>
            <Th>Флаг</Th>
            <Th>Название</Th>
            <Th>Код</Th>
            <Th>Серверы</Th>
            <Th>Тарифы</Th>
            <Th>Действия</Th>
          </>
        }
      >
        {countries.map((c) =>
          editId === c.id ? (
            <Tr key={c.id}>
              <Td>
                <input
                  className="input w-16"
                  value={editForm.flagEmoji}
                  onChange={(e) => setEditForm({ ...editForm, flagEmoji: e.target.value })}
                />
              </Td>
              <Td>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </Td>
              <Td>
                <input
                  className="input w-16"
                  value={editForm.code}
                  maxLength={2}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                />
              </Td>
              <Td>{c._count.servers}</Td>
              <Td>{c._count.tariffs}</Td>
              <Td>
                <div className="flex gap-3">
                  <button className="text-accent" onClick={() => saveEdit(c.id)}>
                    Сохранить
                  </button>
                  <button className="text-faint" onClick={() => setEditId(null)}>
                    Отмена
                  </button>
                </div>
              </Td>
            </Tr>
          ) : (
            <Tr key={c.id}>
              <Td>
                <span className="text-lg">{c.flagEmoji}</span>
              </Td>
              <Td>
                <span className="text-strong">{c.name}</span>
              </Td>
              <Td>
                <span className="mono">{c.code}</span>
              </Td>
              <Td>{c._count.servers}</Td>
              <Td>{c._count.tariffs}</Td>
              <Td>
                <div className="flex gap-3">
                  <button className="text-accent" onClick={() => startEdit(c)}>
                    Изменить
                  </button>
                  <button style={{ color: '#ff8a8a' }} onClick={() => remove(c)}>
                    Удалить
                  </button>
                </div>
              </Td>
            </Tr>
          ),
        )}
      </Table>
    </div>
  );
}
