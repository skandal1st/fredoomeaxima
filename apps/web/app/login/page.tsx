'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { ErrorText } from '../../components/ui';
import { translateAuthError } from '../../lib/errors';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      setError(translateAuthError((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="reveal w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2.5">
            <Glyph />
            <span className="font-display text-2xl font-bold tracking-tight text-strong">
              Axima<span className="text-accent">VPN</span>
            </span>
          </div>
          <h1 className="font-display text-lg font-semibold text-strong">С возвращением</h1>
          <p className="mt-1 text-sm text-dim">Войдите в личный кабинет</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Входим…' : 'Войти'}
          </button>
          <p className="text-center text-sm text-dim">
            Нет аккаунта?{' '}
            <Link href="/register" className="font-medium text-accent hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Glyph() {
  return (
    <span
      className="grid h-9 w-9 place-items-center rounded-lg"
      style={{
        background: 'linear-gradient(160deg, rgba(94,240,192,0.25), rgba(94,240,192,0.05))',
        border: '1px solid rgba(94,240,192,0.35)',
        boxShadow: '0 0 22px -4px var(--accent-glow)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2 4 5.5v6c0 5 3.4 8.2 8 10.5 4.6-2.3 8-5.5 8-10.5v-6L12 2Z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.5 12.2l2.4 2.4 4.6-5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
