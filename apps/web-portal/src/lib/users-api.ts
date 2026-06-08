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

async function del(path: string): Promise<void> {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: { ...authHeader() } });
  if (!r.ok && r.status !== 204) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${r.status}`);
  }
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
  isSystem?: boolean;
  userCount?: number;
  grants?: PermissionCell[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRolePayload {
  code?: string;
  name: string;
  description?: string;
}

export interface UpdateRolePayload {
  name?: string;
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

// ─── Permission types ─────────────────────────────────────────────────────────
export interface PermissionAction {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModuleSummary {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive?: boolean;
}

export interface Module {
  id: string;
  groupId: string;
  groupCode: string;
  groupName: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  allowedActions: PermissionAction[];
}

export interface ModuleGroup {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  modules: ModuleSummary[];
  createdAt?: string;
  updatedAt?: string;
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

// ─── Users API ────────────────────────────────────────────────────────────────
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
    return del(`/users/${id}`);
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

// ─── Roles API ────────────────────────────────────────────────────────────────
export const rolesApi = {
  list(pageSize = 100): Promise<ListRolesResponse> {
    return req(`/roles?page=1&pageSize=${pageSize}`);
  },

  get(id: string): Promise<RoleItem> {
    return req(`/roles/${id}`);
  },

  create(payload: CreateRolePayload): Promise<RoleItem> {
    return req('/roles', { method: 'POST', body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdateRolePayload): Promise<RoleItem> {
    return req(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  remove(id: string): Promise<void> {
    return del(`/roles/${id}`);
  },

  addPermissions(id: string, grants: PermissionPair[]): Promise<RoleItem> {
    return req(`/roles/${id}/permissions`, { method: 'POST', body: JSON.stringify({ grants }) });
  },

  removePermissions(id: string, grants: PermissionPair[]): Promise<RoleItem> {
    return req(`/roles/${id}/permissions`, { method: 'DELETE', body: JSON.stringify({ grants }) });
  },
};

// ─── Organizations API ────────────────────────────────────────────────────────
export const orgsApi = {
  tree(): Promise<OrgTreeResponse> {
    return req('/organizations/tree');
  },
};

// ─── Permissions API ──────────────────────────────────────────────────────────
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

export const userRolesApi = {
  assign(userId: string, roleCode: string): Promise<void> {
    return req(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleCode }),
    }).then(() => undefined);
  },

  remove(userId: string, roleCode: string): Promise<void> {
    return del(`/users/${userId}/roles/${roleCode}`);
  },
};

// ─── Module Groups API (Section 9) ────────────────────────────────────────────
export interface CreateModuleGroupPayload {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface UpdateModuleGroupPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const moduleGroupsApi = {
  list(params?: { activeOnly?: boolean }): Promise<{ items: ModuleGroup[] }> {
    const q = new URLSearchParams();
    if (params?.activeOnly) q.set('activeOnly', 'true');
    return req(`/module-groups?${q}`);
  },

  get(id: string): Promise<ModuleGroup> {
    return req(`/module-groups/${id}`);
  },

  create(payload: CreateModuleGroupPayload): Promise<ModuleGroup> {
    return req('/module-groups', { method: 'POST', body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdateModuleGroupPayload): Promise<ModuleGroup> {
    return req(`/module-groups/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  remove(id: string): Promise<void> {
    return del(`/module-groups/${id}`);
  },
};

// ─── Modules API (Section 10) ──────────────────────────────────────────────────
export interface CreateModulePayload {
  groupId: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  actionIds?: string[];
}

export interface UpdateModulePayload {
  groupId?: string;
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  updateActions?: boolean;
  actionIds?: string[];
}

export const modulesApi = {
  list(params?: { groupId?: string; activeOnly?: boolean }): Promise<{ items: Module[] }> {
    const q = new URLSearchParams();
    if (params?.groupId) q.set('groupId', params.groupId);
    if (params?.activeOnly) q.set('activeOnly', 'true');
    return req(`/modules?${q}`);
  },

  get(id: string): Promise<Module> {
    return req(`/modules/${id}`);
  },

  create(payload: CreateModulePayload): Promise<Module> {
    return req('/modules', { method: 'POST', body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdateModulePayload): Promise<Module> {
    return req(`/modules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  remove(id: string): Promise<void> {
    return del(`/modules/${id}`);
  },

  // Section 12.1 — replace all actions for a module
  setActions(id: string, actionIds: string[]): Promise<Module> {
    return req(`/modules/${id}/actions`, { method: 'PUT', body: JSON.stringify({ actionIds }) });
  },
};

// ─── Permission Actions API (Section 11) ──────────────────────────────────────
export interface CreatePermissionActionPayload {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface UpdatePermissionActionPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const permissionActionsApi = {
  list(params?: { activeOnly?: boolean }): Promise<{ items: PermissionAction[] }> {
    const q = new URLSearchParams();
    if (params?.activeOnly) q.set('activeOnly', 'true');
    return req(`/permission-actions?${q}`);
  },

  get(id: string): Promise<PermissionAction> {
    return req(`/permission-actions/${id}`);
  },

  create(payload: CreatePermissionActionPayload): Promise<PermissionAction> {
    return req('/permission-actions', { method: 'POST', body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdatePermissionActionPayload): Promise<PermissionAction> {
    return req(`/permission-actions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  remove(id: string): Promise<void> {
    return del(`/permission-actions/${id}`);
  },
};
