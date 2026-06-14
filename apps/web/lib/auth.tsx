'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokenStore, Tokens } from './api';

export interface Me {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: string;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    if (!tokenStore.access) {
      setMe(null);
      return;
    }
    try {
      setMe(await api<Me>('/auth/me'));
    } catch {
      setMe(null);
    }
  };

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, []);

  const handleTokens = async (tokens: Tokens) => {
    tokenStore.set(tokens);
    await refreshMe();
  };

  const login = async (email: string, password: string) => {
    const tokens = await api<Tokens>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, { auth: false });
    await handleTokens(tokens);
  };

  const register = async (email: string, password: string) => {
    const tokens = await api<Tokens>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }, { auth: false });
    await handleTokens(tokens);
  };

  const logout = () => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) {
      api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, { auth: false }).catch(() => undefined);
    }
    tokenStore.clear();
    setMe(null);
  };

  return (
    <AuthContext.Provider value={{ me, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
