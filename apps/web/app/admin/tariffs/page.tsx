'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td, Tr, ErrorText } from '../../../components/ui';

interface Country {
  id: string;
  name: string;
  flagEmoji?: string;
}
interface Tariff {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  deviceLimit: number;
  isActive: boolean;
  allowedCountries: { id: string; code: string }[];
}

const EMPTY = { name: '', priceCents: 19900, currency: 'RUB', durationDays: 30, deviceLimit: 3, isActive: true };

export default function AdminTariffsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [t, c] = await Promise.all([api<Tariff[]>('/admin/tariffs'), api<Country[]>('/countries')]);
    setTariffs(t);
    setCountries(c);
  };
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/tariffs', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          priceCents: Number(form.priceCents),
          durationDays: Number(form.durationDays),
          deviceLimit: Number(form.deviceLimit),
          countryIds: selectedCountries,
        }),
      });
      setForm({ ...EMPTY });
      setSelectedCountries([]);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleActive = async (t: Tariff) => {
    await api(`/admin/tariffs/${t.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !t.isActive }) });
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Тарифы" subtitle="Планы, доступные пользователям" />

      <div className="card reveal mb-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">Создать тариф</h2>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <input className="input" placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="number" placeholder="Цена (в центах/копейках)" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) })} />
          <input className="input" placeholder="Валюта (напр. RUB)" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <input className="input" type="number" placeholder="Срок (дней)" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Лимит устройств" value={form.deviceLimit} onChange={(e) => setForm({ ...form, deviceLimit: Number(e.target.value) })} />
          <select
            multiple
            className="input h-24"
            value={selectedCountries}
            onChange={(e) => setSelectedCountries(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flagEmoji} {c.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-3">
            <p className="text-xs text-faint">Оставьте список стран пустым, чтобы разрешить все.</p>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary mt-3">Создать</button>
          </div>
        </form>
      </div>

      <Table
        head={
          <>
            <Th>Название</Th>
            <Th>Цена</Th>
            <Th>Срок</Th>
            <Th>Устройства</Th>
            <Th>Страны</Th>
            <Th>Активен</Th>
          </>
        }
      >
        {tariffs.map((t) => (
          <Tr key={t.id}>
            <Td>
              <span className="text-strong">{t.name}</span>
            </Td>
            <Td>
              <span className="mono">{money(t.priceCents, t.currency)}</span>
            </Td>
            <Td>{t.durationDays} дн.</Td>
            <Td>{t.deviceLimit}</Td>
            <Td>{t.allowedCountries.length === 0 ? 'Все' : t.allowedCountries.map((c) => c.code).join(', ')}</Td>
            <Td>
              <button onClick={() => toggleActive(t)}>
                <Badge status={t.isActive ? 'ACTIVE' : 'DISABLED'} />
              </button>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}
