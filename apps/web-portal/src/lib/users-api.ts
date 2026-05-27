const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api`;

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? `HTTP ${res.status}`);
  return json as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  organizationId?: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleItem {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface OrgNode {
  id: string;
  name: string;
  children?: OrgNode[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: string | number;
  totalPages: number;
}

export interface ListUsersResponse {
  items: UserItem[];
  page: PageMeta;
}

export interface ListRolesResponse {
  items: RoleItem[];
  page: PageMeta;
}

export interface OrgTreeResponse {
  nodes: OrgNode[];
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationId?: string;
  roleCodes?: string[];
}

export interface UpdateUserPayload {
  fullName?: string;
  phone?: string;
  organizationId?: string;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export const usersApi = {
  list(params: ListUsersParams = {}): Promise<ListUsersResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.status) q.set('status', params.status);
    return req(`/users?${q}`);
  },

  create(payload: CreateUserPayload): Promise<UserItem> {
    return req('/users', { method: 'POST', body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdateUserPayload): Promise<UserItem> {
    return req(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  remove(id: string): Promise<void> {
    return fetch(`${BASE}/users/${id}`, { method: 'DELETE', headers: { ...authHeader() } })
      .then(async r => {
        if (!r.ok && r.status !== 204) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message ?? `HTTP ${r.status}`);
        }
      });
  },

  changeStatus(id: string, status: string): Promise<UserItem> {
    return req(`/users/${id}/change-status`, { method: 'POST', body: JSON.stringify({ status }) });
  },

  changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    return req(`/users/${id}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },
};

export const rolesApi = {
  list(pageSize = 100): Promise<ListRolesResponse> {
    return req(`/roles?page=1&pageSize=${pageSize}`);
  },
};

export const orgsApi = {
  tree(): Promise<OrgTreeResponse> {
    return req('/organizations/tree');
  },
};

// ─── Permission types ─────────────────────────────────────────────────────────
export interface ModuleSummary {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface ModuleGroup {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  modules: ModuleSummary[];
}

export interface PermissionAction {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface PermissionCell {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  actionId: string;
  actionCode: string;
  actionName: string;
}

export interface UserPermissionsData {
  userId: string;
  roleGrants: PermissionCell[];
  effective: PermissionCell[];
}

export interface PermissionPair {
  moduleId: string;
  actionId: string;
}

// ─── Permission APIs ──────────────────────────────────────────────────────────
export const permissionsApi = {
  getUser(userId: string): Promise<UserPermissionsData> {
    return req(`/users/${userId}/permissions`);
  },

  setUser(userId: string, effectiveGrants: PermissionPair[]): Promise<void> {
    return req(`/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ effectiveGrants }),
    });
  },
};

export const moduleGroupsApi = {
  list(): Promise<{ items: ModuleGroup[] }> {
    return req('/module-groups?activeOnly=true');
  },
};

export const permissionActionsApi = {
  list(): Promise<{ items: PermissionAction[] }> {
    return req('/permission-actions?activeOnly=true');
  },
};
