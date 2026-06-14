'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { date } from '../../../lib/format';
import { PageHeader, Spinner } from '../../../components/ui';

interface RouteGroup {
  id: string;
  key: string;
  name: string;
  domains: string[];
  isEnabled: boolean;
}
interface CurrentVersion {
  version: number;
  createdAt: string;
  entries: { cidr: string; routeGroup: { key: string } }[];
}

export default function AdminRoutesPage() {
  const [groups, setGroups] = useState<RouteGroup[]>([]);
  const [current, setCurrent] = useState<CurrentVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const load = async () => {
    const [g, c] = await Promise.all([api<RouteGroup[]>('/routes/groups'), api<CurrentVersion | null>('/routes/current')]);
    setGroups(g);
    setCurrent(c);
  };
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const toggle = async (g: RouteGroup) => {
    await api(`/admin/routes/groups/${g.key}/enabled`, { method: 'PATCH', body: JSON.stringify({ isEnabled: !g.isEnabled }) });
    await load();
  };

  const resolveNow = async () => {
    setResolving(true);
    try {
      await api('/admin/routes/resolve', { method: 'POST' });
      await load();
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <Spinner />;

  const entriesByGroup = (key: string) => current?.entries.filter((e) => e.routeGroup.key === key).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Маршруты"
        subtitle="Сервисы для раздельного туннелирования — домены резолвятся в диапазоны IP и версионируются"
        action={
          <button className="btn-primary" onClick={resolveNow} disabled={resolving}>
            {resolving ? 'Обновляем…' : 'Обновить и опубликовать'}
          </button>
        }
      />

      {current && (
        <div
          className="reveal mb-5 rounded-lg px-4 py-2.5 text-sm"
          style={{ background: 'rgba(94,240,192,0.06)', border: '1px solid rgba(94,240,192,0.2)', color: 'var(--text-dim)' }}
        >
          Текущий список маршрутов: <strong className="text-accent">v{current.version}</strong> · {current.entries.length} CIDR ·
          опубликован {date(current.createdAt)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="card reveal">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-strong">{g.name}</h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-dim">
                <input type="checkbox" checked={g.isEnabled} onChange={() => toggle(g)} style={{ accentColor: 'var(--accent)' }} />
                {g.isEnabled ? 'Включён' : 'Выключен'}
              </label>
            </div>
            <p className="mt-1 text-xs text-faint">{entriesByGroup(g.key)} CIDR в текущей версии</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.domains.map((d) => (
                <span
                  key={d}
                  className="mono rounded px-2 py-0.5 text-xs"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
