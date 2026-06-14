'use client';

import { useEffect, useState } from 'react';
import { api, apiUrl, tokenStore } from '../../../lib/api';
import { Badge, PageHeader, Spinner, ErrorText } from '../../../components/ui';

interface Country {
  id: string;
  name: string;
  flagEmoji?: string;
}
interface AvailableServer {
  id: string;
  name: string;
  country: { code: string; flagEmoji?: string };
  load: number;
  capacity: number;
}
interface Peer {
  id: string;
  label?: string;
  assignedIp: string;
  status: string;
  needsUpdate: boolean;
  server: { name: string; country: { code: string; flagEmoji?: string } };
}

export default function ConfigsPage() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [servers, setServers] = useState<AvailableServer[]>([]);
  const [country, setCountry] = useState('');
  const [serverId, setServerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ id: string; dataUrl: string } | null>(null);

  const load = async () => {
    const [p, c] = await Promise.all([api<Peer[]>('/peers'), api<Country[]>('/countries')]);
    setPeers(p);
    setCountries(c);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api<AvailableServer[]>(`/servers/available${country ? `?countryId=${country}` : ''}`).then((s) => {
      setServers(s);
      setServerId(s[0]?.id ?? '');
    });
  }, [country]);

  const createPeer = async () => {
    setError('');
    if (!serverId) {
      setError('Select a server');
      return;
    }
    setCreating(true);
    try {
      await api('/peers', { method: 'POST', body: JSON.stringify({ serverId }) });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const showQr = async (id: string) => {
    const { dataUrl } = await api<{ dataUrl: string }>(`/peers/${id}/qr`);
    setQr({ id, dataUrl });
  };

  const downloadConf = (id: string) => {
    // Direct link with the access token as a fallback header isn't possible for
    // <a download>, so fetch as blob and trigger a download.
    fetch(`${apiUrl}/peers/${id}/config`, { headers: { Authorization: `Bearer ${tokenStore.access}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aximavpn-${id}.conf`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const revoke = async (id: string) => {
    await api(`/peers/${id}`, { method: 'DELETE' });
    await load();
  };
  const recreate = async (id: string) => {
    await api(`/peers/${id}/recreate`, { method: 'POST' });
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="VPN Configs" subtitle="Split-tunnel WireGuard configs for selected services only" />

      <div className="card mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Create config</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label className="label">Country</label>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Any</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flagEmoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className="label">Server</label>
            <select className="input" value={serverId} onChange={(e) => setServerId(e.target.value)}>
              {servers.length === 0 && <option value="">No servers available</option>}
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.country.flagEmoji} {s.name} ({s.load}/{s.capacity})
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={createPeer} disabled={creating || !serverId}>
            {creating ? 'Creating…' : 'Create config'}
          </button>
        </div>
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {peers.map((peer) => (
          <div key={peer.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">
                  {peer.server.country.flagEmoji} {peer.server.name}
                </p>
                <p className="text-xs text-slate-400">{peer.assignedIp}</p>
              </div>
              <Badge status={peer.status} />
            </div>

            {peer.needsUpdate && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Route list updated — recreate this config to refresh allowed services.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => showQr(peer.id)}>
                QR code
              </button>
              <button className="btn-ghost" onClick={() => downloadConf(peer.id)}>
                Download .conf
              </button>
              <button className="btn-ghost" onClick={() => recreate(peer.id)}>
                Recreate
              </button>
              <button className="btn-danger" onClick={() => revoke(peer.id)}>
                Revoke
              </button>
            </div>
          </div>
        ))}
        {peers.length === 0 && <p className="text-sm text-slate-400">No configs yet.</p>}
      </div>

      {qr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQr(null)}
        >
          <div className="rounded-xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Scan with the WireGuard app</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.dataUrl} alt="WireGuard QR" className="mx-auto" width={320} height={320} />
            <button className="btn-ghost mt-4" onClick={() => setQr(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
