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

function translateError(msg: string): string {
  if (/No active subscription/i.test(msg)) return 'Нет активной подписки';
  if (/Device limit/i.test(msg)) return 'Достигнут лимит устройств по тарифу';
  if (/Server is at capacity/i.test(msg)) return 'Сервер заполнен, выберите другой';
  if (/Country not included/i.test(msg)) return 'Эта страна не входит в ваш тариф';
  if (/Server not available|not registered/i.test(msg)) return 'Сервер недоступен';
  return msg;
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
      setError('Выберите сервер');
      return;
    }
    setCreating(true);
    try {
      await api('/peers', { method: 'POST', body: JSON.stringify({ serverId }) });
      await load();
    } catch (err) {
      setError(translateError((err as Error).message));
    } finally {
      setCreating(false);
    }
  };

  const showQr = async (id: string) => {
    const { dataUrl } = await api<{ dataUrl: string }>(`/peers/${id}/qr`);
    setQr({ id, dataUrl });
  };

  const downloadConf = (id: string) => {
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
      <PageHeader
        title="VPN-конфиги"
        subtitle="Раздельное туннелирование: через VPN идёт трафик только выбранных сервисов, остальной — напрямую."
      />

      <div className="card reveal mb-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">Новый конфиг</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label className="label">Страна</label>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Любая</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flagEmoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[240px]">
            <label className="label">Сервер</label>
            <select className="input" value={serverId} onChange={(e) => setServerId(e.target.value)}>
              {servers.length === 0 && <option value="">Нет доступных серверов</option>}
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.country.flagEmoji} {s.name} ({s.load}/{s.capacity})
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={createPeer} disabled={creating || !serverId}>
            {creating ? 'Создаём…' : 'Создать конфиг'}
          </button>
        </div>
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {peers.map((peer) => (
          <div key={peer.id} className="card reveal">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-strong">
                  {peer.server.country.flagEmoji} {peer.server.name}
                </p>
                <p className="mono mt-0.5 text-xs text-faint">{peer.assignedIp}</p>
              </div>
              <Badge status={peer.status} />
            </div>

            {peer.needsUpdate && (
              <div
                className="mt-3 rounded-lg px-3 py-2 text-xs"
                style={{ background: 'rgba(247,198,107,0.08)', border: '1px solid rgba(247,198,107,0.25)', color: 'var(--warn)' }}
              >
                Список маршрутов обновился — пересоздайте конфиг, чтобы обновить список сервисов.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => showQr(peer.id)}>
                QR-код
              </button>
              <button className="btn-ghost" onClick={() => downloadConf(peer.id)}>
                Скачать .conf
              </button>
              <button className="btn-ghost" onClick={() => recreate(peer.id)}>
                Пересоздать
              </button>
              <button className="btn-danger" onClick={() => revoke(peer.id)}>
                Отозвать
              </button>
            </div>
          </div>
        ))}
        {peers.length === 0 && <p className="text-sm text-faint">Конфигов пока нет.</p>}
      </div>

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setQr(null)}>
          <div className="card text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-display font-semibold text-strong">Отсканируйте в приложении WireGuard</h3>
            <p className="mb-4 text-xs text-faint">iOS / Android · «Добавить туннель» → «Сканировать QR-код»</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.dataUrl} alt="WireGuard QR" className="mx-auto rounded-lg" width={320} height={320} />
            <button className="btn-ghost mt-4 w-full" onClick={() => setQr(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
