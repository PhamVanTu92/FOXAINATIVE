const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/auth`;

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export const authApi = {
  login: (username: string, password: string) =>
    post<LoginResponse>('/login', { username, password }),

  logout: (refreshToken: string) =>
    post<void>('/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    post<LoginResponse>('/refresh', { refreshToken }),
};
