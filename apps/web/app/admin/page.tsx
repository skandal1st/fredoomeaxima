'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { money, date } from '../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td, ErrorText } from '../../components/ui';

interface Country {
  id: string;
  name: string;
  flagEmoji?: string;
}
interface Server {
  id: string;
  name: string;
  ip: string;
  status: string;
  provisionStatus: string;
  maxPeers: number;
  wgEndpointPort: number;
  monthlyCostCents: number;
  costCurrency: string;
  nextRenewalAt?: string;
  country: { code: string; name: string; flagEmoji?: string };
  _count: { peers: number };
}
interface ProvState {
  status: string;
  provisionStatus: string;
  provisionLog?: string;
}

const EMPTY = {
  name: '',
  countryId: '',
  ip: '',
  sshUser: 'root',
  sshPort: 22,
  sshPassword: '',
  provision: true,
  wgEndpointPort: 51820,
  maxPeers: 200,
  monthlyCostCents: 0,
  costCurrency: 'USD',
  provider: '',
};

export default function AdminServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ command: string } | null>(null);

  // Live provisioning log viewer.
  const [logServer, setLogServer] = useState<{ id: string; name: string } | null>(null);
  const [prov, setProv] = useState<ProvState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const [s, c] = await Promise.all([api<Server[]>('/admin/servers'), api<Country[]>('/countries')]);
    setServers(s);
    setCountries(c);
    if (!form.countryId && c[0]) setForm((f) => ({ ...f, countryId: c[0].id }));
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const openLog = (id: string, name: string) => {
    setLogServer({ id, name });
    setProv(null);
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      try {
        const state = await api<ProvState>(`/admin/servers/${id}/provision`);
        setProv(state);
        if (state.provisionStatus !== 'RUNNING' && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          await load();
        }
      } catch {
        /* keep polling */
      }
    };
    void poll();
    pollRef.current = setInterval(poll, 2000);
  };

  const closeLog = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setLogServer(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.provision && !form.sshPassword) {
      setError('SSH password is required to deploy over SSH');
      return;
    }
    try {
      const res = await api<{ command: string; server: { id: string; name: string }; provisioning: boolean }>(
        '/admin/servers',
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            wgEndpointPort: Number(form.wgEndpointPort),
            sshPort: Number(form.sshPort),
            maxPeers: Number(form.maxPeers),
            monthlyCostCents: Number(form.monthlyCostCents),
          }),
        },
      );
      setCreated({ command: res.command });
      const provisioning = res.provisioning;
      const serverId = res.server.id;
      const serverName = res.server.name;
      setForm({ ...EMPTY, countryId: countries[0]?.id ?? '' });
      await load();
      if (provisioning) openLog(serverId, serverName);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const reprovision = async (s: Server) => {
    const password = prompt(`SSH password for ${s.country.name} server "${s.name}" (${s.ip})`);
    if (!password) return;
    await api(`/admin/servers/${s.id}/provision`, { method: 'POST', body: JSON.stringify({ password }) });
    openLog(s.id, s.name);
  };

  const runHealth = async (id: string) => {
    await api(`/admin/servers/${id}/health/run`, { method: 'POST' });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this server?')) return;
    await api(`/admin/servers/${id}`, { method: 'DELETE' });
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="VPN Servers" subtitle="Add a server — the panel installs WireGuard over SSH automatically" />

      <div className="mb-6 card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Add server</h2>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="input" value={form.countryId} onChange={(e) => setForm({ ...form, countryId: e.target.value })} required>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flagEmoji} {c.name}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Public IP" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} required />

          <input className="input" placeholder="SSH user" value={form.sshUser} onChange={(e) => setForm({ ...form, sshUser: e.target.value })} />
          <input className="input" type="number" placeholder="SSH port" value={form.sshPort} onChange={(e) => setForm({ ...form, sshPort: Number(e.target.value) })} />
          <input
            className="input"
            type="password"
            placeholder="SSH password"
            autoComplete="new-password"
            value={form.sshPassword}
            onChange={(e) => setForm({ ...form, sshPassword: e.target.value })}
          />

          <input className="input" type="number" placeholder="WG port" value={form.wgEndpointPort} onChange={(e) => setForm({ ...form, wgEndpointPort: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Max peers" value={form.maxPeers} onChange={(e) => setForm({ ...form, maxPeers: Number(e.target.value) })} />
          <input className="input" placeholder="Provider (e.g. Hetzner)" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          <input className="input" type="number" placeholder="Monthly cost (cents)" value={form.monthlyCostCents} onChange={(e) => setForm({ ...form, monthlyCostCents: Number(e.target.value) })} />
          <input className="input" placeholder="Cost currency" value={form.costCurrency} onChange={(e) => setForm({ ...form, costCurrency: e.target.value })} />

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.provision} onChange={(e) => setForm({ ...form, provision: e.target.checked })} />
            Deploy over SSH now
          </label>

          <div className="md:col-span-3">
            <p className="text-xs text-slate-400">
              With “Deploy over SSH” the panel connects, installs WireGuard + agent and registers the server. The SSH
              password is used once and never stored.
            </p>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary mt-2">Add server</button>
          </div>
        </form>
        {created && !form.provision && (
          <div className="mt-4 rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            <p className="mb-2 text-slate-400">Or run this manually on a fresh Ubuntu 22.04/24.04 VPS as root:</p>
            <code className="block break-all">{created.command}</code>
          </div>
        )}
      </div>

      <Table
        head={
          <>
            <Th>Name</Th>
            <Th>Country</Th>
            <Th>IP</Th>
            <Th>Load</Th>
            <Th>Cost / mo</Th>
            <Th>Status</Th>
            <Th>Deploy</Th>
            <Th>Actions</Th>
          </>
        }
      >
        {servers.map((s) => (
          <tr key={s.id}>
            <Td>{s.name}</Td>
            <Td>
              {s.country.flagEmoji} {s.country.name}
            </Td>
            <Td>{s.ip}</Td>
            <Td>
              {s._count.peers}/{s.maxPeers}
            </Td>
            <Td>{money(s.monthlyCostCents, s.costCurrency)}</Td>
            <Td>
              <Badge status={s.status} />
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <Badge status={s.provisionStatus} />
                {s.provisionStatus === 'RUNNING' && (
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => openLog(s.id, s.name)}>
                    Log
                  </button>
                )}
              </div>
            </Td>
            <Td>
              <div className="flex gap-2">
                {(s.status === 'PENDING' || s.provisionStatus === 'FAILED') && (
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => reprovision(s)}>
                    {s.provisionStatus === 'FAILED' ? 'Retry' : 'Deploy'}
                  </button>
                )}
                <button className="text-xs text-brand-600 hover:underline" onClick={() => runHealth(s.id)}>
                  Check
                </button>
                <button className="text-xs text-red-600 hover:underline" onClick={() => remove(s.id)}>
                  Delete
                </button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      {logServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeLog}>
          <div className="flex h-[70vh] w-full max-w-3xl flex-col rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Provisioning · {logServer.name}</h3>
              <div className="flex items-center gap-3">
                {prov && <Badge status={prov.provisionStatus} />}
                <button className="btn-ghost" onClick={closeLog}>
                  Close
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
              {prov?.provisionLog || 'Waiting for output…'}
            </pre>
            {prov?.provisionStatus === 'SUCCESS' && (
              <p className="mt-2 text-sm text-green-600">Done — server status is now {prov.status}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
