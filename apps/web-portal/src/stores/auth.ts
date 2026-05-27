'use client';

import { create } from 'zustand';
import { authApi, type UserProfile } from '@/lib/auth-api';

const COOKIE_KEY = 'access_token';
const LS_ACCESS = 'access_token';
const LS_REFRESH = 'refresh_token';

function setCookie(value: string, maxAge = 7 * 24 * 3600) {
  document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function removeCookie() {
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0`;
}

function readFromStorage(): { accessToken: string | null; refreshToken: string | null; user: UserProfile | null } {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null, user: null };
  const accessToken = localStorage.getItem(LS_ACCESS);
  const refreshToken = localStorage.getItem(LS_REFRESH);
  const raw = localStorage.getItem('auth_user');
  const user: UserProfile | null = raw ? JSON.parse(raw) : null;
  return { accessToken, refreshToken, user };
}

interface AuthStore {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;

  init: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,

  init() {
    const { accessToken, refreshToken, user } = readFromStorage();
    if (accessToken) set({ accessToken, refreshToken, user });
  },

  async login(username, password) {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login(username, password);
      localStorage.setItem(LS_ACCESS, data.accessToken);
      localStorage.setItem(LS_REFRESH, data.refreshToken);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      setCookie(data.accessToken, data.expiresIn);
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  async logout() {
    const { refreshToken } = get();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // ignore errors on logout
    } finally {
      localStorage.removeItem(LS_ACCESS);
      localStorage.removeItem(LS_REFRESH);
      localStorage.removeItem('auth_user');
      removeCookie();
      set({ user: null, accessToken: null, refreshToken: null });
    }
  },

  clearError: () => set({ error: null }),
}));
