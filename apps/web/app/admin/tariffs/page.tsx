'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { money } from '../../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td, ErrorText } from '../../../components/ui';

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
      <PageHeader title="Tariffs" subtitle="Plans available to users" />

      <div className="mb-6 card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Create tariff</h2>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="number" placeholder="Price (cents)" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) })} />
          <input className="input" placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <input className="input" type="number" placeholder="Duration (days)" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Device limit" value={form.deviceLimit} onChange={(e) => setForm({ ...form, deviceLimit: Number(e.target.value) })} />
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
            <p className="text-xs text-slate-400">Leave countries empty to allow all.</p>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary mt-2">Create</button>
          </div>
        </form>
      </div>

      <Table
        head={
          <>
            <Th>Name</Th>
            <Th>Price</Th>
            <Th>Duration</Th>
            <Th>Devices</Th>
            <Th>Countries</Th>
            <Th>Active</Th>
          </>
        }
      >
        {tariffs.map((t) => (
          <tr key={t.id}>
            <Td>{t.name}</Td>
            <Td>{money(t.priceCents, t.currency)}</Td>
            <Td>{t.durationDays}d</Td>
            <Td>{t.deviceLimit}</Td>
            <Td>{t.allowedCountries.length === 0 ? 'All' : t.allowedCountries.map((c) => c.code).join(', ')}</Td>
            <Td>
              <button onClick={() => toggleActive(t)}>
                <Badge status={t.isActive ? 'ACTIVE' : 'DISABLED'} />
              </button>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
