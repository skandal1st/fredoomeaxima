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
        title="Route Groups"
        subtitle="Split-tunnel services — domains are resolved to IP ranges and versioned"
        action={
          <button className="btn-primary" onClick={resolveNow} disabled={resolving}>
            {resolving ? 'Resolving…' : 'Resolve & publish now'}
          </button>
        }
      />

      {current && (
        <div className="mb-4 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          Current route list: <strong>v{current.version}</strong> · {current.entries.length} CIDRs · published {date(current.createdAt)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{g.name}</h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={g.isEnabled} onChange={() => toggle(g)} />
                {g.isEnabled ? 'Enabled' : 'Disabled'}
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-400">{entriesByGroup(g.key)} resolved CIDRs in current version</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {g.domains.map((d) => (
                <span key={d} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
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
