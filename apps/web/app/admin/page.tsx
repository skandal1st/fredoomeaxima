'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { Badge, PageHeader, Spinner, Table, Th, Td, Tr, ErrorText } from '../../components/ui';

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
interface AgentDiag {
  agentUrl: string;
  agentReachable: boolean;
  status: { wgUp: boolean; peerCount: number; uptimeSeconds: number } | null;
  statusError?: string;
  targets: { results: Record<string, boolean>; dnsOk: boolean } | null;
  targetsError?: string;
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

  const [logServer, setLogServer] = useState<{ id: string; name: string } | null>(null);
  const [prov, setProv] = useState<ProvState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [busy, setBusy] = useState<string | null>(null); // serverId of in-flight restart
  const [diagServer, setDiagServer] = useState<{ id: string; name: string } | null>(null);
  const [diag, setDiag] = useState<AgentDiag | null>(null);
  const [diagError, setDiagError] = useState('');

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
      setError('Для развёртывания по SSH нужен пароль');
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
      const { provisioning } = res;
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
    const password = prompt(`SSH-пароль для сервера «${s.name}» (${s.ip})`);
    if (!password) return;
    await api(`/admin/servers/${s.id}/provision`, { method: 'POST', body: JSON.stringify({ password }) });
    openLog(s.id, s.name);
  };

  const runHealth = async (id: string) => {
    await api(`/admin/servers/${id}/health/run`, { method: 'POST' });
    await load();
  };

  const restartWg = async (s: Server) => {
    if (!confirm(`Перезапустить WireGuard на сервере «${s.name}»? Активные подключения кратковременно прервутся.`)) return;
    setBusy(s.id);
    try {
      await api(`/admin/servers/${s.id}/restart`, { method: 'POST' });
      alert('Команда на перезапуск отправлена. Через минуту проверьте статус («Диагностика»).');
    } catch (err) {
      alert(`Не удалось перезапустить: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const openDiag = async (s: Server) => {
    setDiagServer({ id: s.id, name: s.name });
    setDiag(null);
    setDiagError('');
    try {
      setDiag(await api<AgentDiag>(`/admin/servers/${s.id}/agent-status`));
    } catch (err) {
      setDiagError((err as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить сервер?')) return;
    await api(`/admin/servers/${id}`, { method: 'DELETE' });
    await load();
  };

  if (loading) return <Spinner />;

  const field = (key: keyof typeof EMPTY, placeholder: string, type = 'text') => (
    <input
      className="input"
      type={type}
      placeholder={placeholder}
      value={form[key] as string | number}
      onChange={(e) =>
        setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="VPN-серверы"
        subtitle="Добавьте сервер — панель сама подключится по SSH и развернёт WireGuard."
      />

      <div className="card reveal mb-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">Добавить сервер</h2>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          {field('name', 'Название')}
          <select className="input" value={form.countryId} onChange={(e) => setForm({ ...form, countryId: e.target.value })} required>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flagEmoji} {c.name}
              </option>
            ))}
          </select>
          {field('ip', 'Публичный IP')}

          {field('sshUser', 'SSH-пользователь')}
          {field('sshPort', 'SSH-порт', 'number')}
          <input
            className="input"
            type="password"
            placeholder="SSH-пароль"
            autoComplete="new-password"
            value={form.sshPassword}
            onChange={(e) => setForm({ ...form, sshPassword: e.target.value })}
          />

          {field('wgEndpointPort', 'Порт WireGuard', 'number')}
          {field('maxPeers', 'Макс. пользователей', 'number')}
          {field('provider', 'Провайдер (напр. Hetzner)')}
          {field('monthlyCostCents', 'Стоимость в мес. (в центах)', 'number')}
          {field('costCurrency', 'Валюта расходов')}

          <label className="flex items-center gap-2.5 text-sm text-dim">
            <input
              type="checkbox"
              checked={form.provision}
              onChange={(e) => setForm({ ...form, provision: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            Развернуть по SSH сейчас
          </label>

          <div className="md:col-span-3">
            <p className="text-xs text-faint">
              При включённой опции панель подключится по SSH, установит WireGuard и агент и зарегистрирует сервер.
              Пароль используется один раз и не сохраняется.
            </p>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary mt-3">Добавить сервер</button>
          </div>
        </form>
        {created && !form.provision && (
          <div
            className="mono mt-4 rounded-lg p-4 text-xs"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-strong)', color: 'var(--text-dim)' }}
          >
            <p className="mb-2 text-faint">Или запустите вручную на чистом Ubuntu 22.04/24.04 от root:</p>
            <code className="block break-all text-accent">{created.command}</code>
          </div>
        )}
      </div>

      <Table
        head={
          <>
            <Th>Название</Th>
            <Th>Страна</Th>
            <Th>IP</Th>
            <Th>Нагрузка</Th>
            <Th>Стоимость/мес</Th>
            <Th>Статус</Th>
            <Th>Развёртывание</Th>
            <Th>Действия</Th>
          </>
        }
      >
        {servers.map((s) => (
          <Tr key={s.id}>
            <Td>
              <span className="text-strong">{s.name}</span>
            </Td>
            <Td>
              {s.country.flagEmoji} {s.country.name}
            </Td>
            <Td>
              <span className="mono">{s.ip}</span>
            </Td>
            <Td>
              <span className="mono">
                {s._count.peers}/{s.maxPeers}
              </span>
            </Td>
            <Td>
              <span className="mono">{money(s.monthlyCostCents, s.costCurrency)}</span>
            </Td>
            <Td>
              <Badge status={s.status} />
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <Badge status={s.provisionStatus} />
                {s.provisionStatus === 'RUNNING' && (
                  <button className="text-xs text-accent hover:underline" onClick={() => openLog(s.id, s.name)}>
                    лог
                  </button>
                )}
              </div>
            </Td>
            <Td>
              <div className="flex gap-3">
                {(s.status === 'PENDING' || s.provisionStatus === 'FAILED') && (
                  <button className="text-xs text-accent hover:underline" onClick={() => reprovision(s)}>
                    {s.provisionStatus === 'FAILED' ? 'Повторить' : 'Развернуть'}
                  </button>
                )}
                <button className="text-xs text-dim hover:text-strong" onClick={() => runHealth(s.id)}>
                  Проверить
                </button>
                <button className="text-xs text-dim hover:text-strong" onClick={() => openDiag(s)}>
                  Диагностика
                </button>
                <button
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                  disabled={busy === s.id}
                  onClick={() => restartWg(s)}
                >
                  {busy === s.id ? 'Перезапуск…' : 'Перезапустить'}
                </button>
                <button className="text-xs hover:underline" style={{ color: '#ff8a8a' }} onClick={() => remove(s.id)}>
                  Удалить
                </button>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>

      {logServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={closeLog}>
          <div className="card flex h-[70vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-semibold text-strong">Развёртывание · {logServer.name}</h3>
              <div className="flex items-center gap-3">
                {prov && <Badge status={prov.provisionStatus} />}
                <button className="btn-ghost" onClick={closeLog}>
                  Закрыть
                </button>
              </div>
            </div>
            <pre
              className="mono flex-1 overflow-auto rounded-lg p-4 text-xs leading-relaxed"
              style={{ background: '#05080d', border: '1px solid var(--border)', color: '#b9e8d6' }}
            >
              {prov?.provisionLog || 'Ожидание вывода…'}
            </pre>
            {prov?.provisionStatus === 'SUCCESS' && (
              <p className="mt-2 text-sm text-accent">Готово — статус сервера: {prov.status}.</p>
            )}
          </div>
        </div>
      )}

      {diagServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setDiagServer(null)}>
          <div className="card flex max-h-[80vh] w-full max-w-lg flex-col overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display font-semibold text-strong">Диагностика · {diagServer.name}</h3>
              <button className="btn-ghost" onClick={() => setDiagServer(null)}>
                Закрыть
              </button>
            </div>

            {!diag && !diagError && <Spinner />}
            {diagError && <ErrorText>{diagError}</ErrorText>}

            {diag && (
              <div className="space-y-4 text-sm">
                <p className="text-faint">
                  Агент: <span className="mono text-dim">{diag.agentUrl}</span>
                </p>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">WireGuard</p>
                  {diag.status ? (
                    <ul className="space-y-1 text-dim">
                      <li>Интерфейс: {diag.status.wgUp ? <span className="text-accent">поднят</span> : <span style={{ color: '#ff8a8a' }}>не поднят</span>}</li>
                      <li>Подключений (пиров): <span className="mono">{diag.status.peerCount}</span></li>
                      <li>Аптайм агента: <span className="mono">{Math.floor(diag.status.uptimeSeconds / 60)} мин</span></li>
                    </ul>
                  ) : (
                    <p style={{ color: '#ff8a8a' }}>Агент недоступен{diag.statusError ? `: ${diag.statusError}` : ''}</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">Доступность сервисов</p>
                  {diag.targets ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(diag.targets.results).map(([name, ok]) => (
                        <span
                          key={name}
                          className="rounded px-2 py-0.5 text-xs"
                          style={{
                            background: ok ? 'rgba(94,240,192,0.08)' : 'rgba(255,138,138,0.1)',
                            color: ok ? 'var(--accent)' : '#ff8a8a',
                          }}
                        >
                          {ok ? '✓' : '✕'} {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#ff8a8a' }}>Проверка недоступна{diag.targetsError ? `: ${diag.targetsError}` : ''}</p>
                  )}
                </div>

                {!diag.agentReachable && (
                  <p className="text-xs text-faint">
                    Агент не отвечает по {diag.agentUrl}. Проверьте, что сервис агента и WireGuard запущены на сервере
                    (см. подсказки ниже), затем нажмите «Перезапустить».
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
