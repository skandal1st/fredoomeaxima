'use client';

/**
 * Thin browser API client. Stores tokens in localStorage, attaches the access
 * token, and transparently refreshes once on 401. For an MVP this is adequate;
 * a production hardening step would move tokens to httpOnly cookies.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ACCESS_KEY = 'axima_access';
const REFRESH_KEY = 'axima_refresh';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const tokenStore = {
  get access() {
    return typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
  },
  get refresh() {
    return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
  },
  set(tokens: Tokens) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, init: RequestInit, withAuth: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (withAuth && tokenStore.access) headers.set('Authorization', `Bearer ${tokenStore.access}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  const res = await rawFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false);
  if (!res.ok) {
    tokenStore.clear();
    return false;
  }
  tokenStore.set((await res.json()) as Tokens);
  return true;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean; raw?: boolean } = {},
): Promise<T> {
  const withAuth = opts.auth ?? true;
  let res = await rawFetch(path, init, withAuth);

  if (res.status === 401 && withAuth && (await tryRefresh())) {
    res = await rawFetch(path, init, withAuth);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const message = (body as { message?: string })?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message, body);
  }

  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiUrl = API_URL;
