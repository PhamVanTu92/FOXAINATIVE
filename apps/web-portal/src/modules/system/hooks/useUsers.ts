'use client';

import { useState, useEffect, useCallback } from 'react';
import { usersApi, rolesApi, orgsApi } from '@/lib/users-api';
import type { UserItem, RoleItem, OrgNode } from '@/lib/users-api';

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
}

function flattenOrg(nodes: OrgNode[]): OrgNode[] {
  const result: OrgNode[] = [];
  function visit(n: OrgNode) {
    result.push(n);
    n.children?.forEach(visit);
  }
  nodes.forEach(visit);
  return result;
}

export function useUsers() {
  // ── Table data ──────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Loading / error ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Reference data ───────────────────────────────────────────────────────────
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});
  const [flatOrgs, setFlatOrgs] = useState<OrgNode[]>([]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, inactive: 0, admins: 0 });

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);

  // ── Load main list ────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list({ page, pageSize, search, status: statusFilter || undefined });
      setUsers(data.items);
      const tot = Number(data.page?.totalItems ?? 0);
      setTotal(tot);
      setTotalPages(data.page?.totalPages ?? (Math.ceil(tot / pageSize) || 1));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  // ── Load stats ────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const [d1, d2, d3] = await Promise.all([
        usersApi.list({ page: 1, pageSize: 1 }),
        usersApi.list({ page: 1, pageSize: 1, status: 'ACTIVE' }),
        usersApi.list({ page: 1, pageSize: 1, status: 'INACTIVE' }),
      ]);
      const tot = Number(d1.page?.totalItems ?? 0);
      const active = Number(d2.page?.totalItems ?? 0);
      const inactive = Number(d3.page?.totalItems ?? 0);

      const firstPage = await usersApi.list({ page: 1, pageSize: 100 });
      const totalPages = firstPage.page?.totalPages ?? 1;
      let allItems = [...firstPage.items];
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            usersApi.list({ page: i + 2, pageSize: 100 })
          )
        );
        rest.forEach(r => allItems.push(...r.items));
      }
      const admins = allItems.filter(u =>
        u.roles.some(r => r.toLowerCase().includes('quản trị') || r.toLowerCase() === 'admin')
      ).length;

      setStats({ total: tot, active, inactive, admins });
    } catch {
      // stats errors are non-fatal
    }
  }, []);

  // ── Load reference data ───────────────────────────────────────────────────────
  const loadRoles = useCallback(async () => {
    try {
      const data = await rolesApi.list();
      setRoles(data.items);
    } catch {
      // ignore
    }
  }, []);

  const loadOrgs = useCallback(async () => {
    try {
      const data = await orgsApi.tree();
      const flat = flattenOrg(data.nodes ?? []);
      const map: Record<string, string> = {};
      flat.forEach(n => { map[n.id] = n.name; });
      setOrgMap(map);
      setFlatOrgs(flat);
    } catch {
      // ignore
    }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadRoles();
    loadOrgs();
    loadStats();
  }, [loadRoles, loadOrgs, loadStats]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleToggleStatus = async (user: UserItem) => {
    const next = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersApi.changeStatus(user.id, next);
      await loadUsers();
      loadStats();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const handleRefresh = () => {
    loadUsers();
    loadStats();
  };

  // ── Role filter (client-side — API has no roleCode filter param) ───────────────
  const displayedUsers = roleFilter
    ? users.filter(u => u.roles.includes(roleFilter))
    : users;

  return {
    // table
    users: displayedUsers, total, totalPages, page, setPage, pageSize,
    // filters
    search, setSearch,
    roleFilter, setRoleFilter,
    statusFilter, setStatusFilter,
    // state
    loading, error,
    // reference data
    roles, orgMap, flatOrgs,
    // stats
    stats,
    // modals
    showCreate, setShowCreate,
    editingUser, setEditingUser,
    permissionsUser, setPermissionsUser,
    deletingUser, setDeletingUser,
    // actions
    handleToggleStatus, handleRefresh,
    loadUsers, loadStats,
  };
}
