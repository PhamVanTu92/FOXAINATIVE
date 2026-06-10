'use client';

import { useState, useEffect, useCallback } from 'react';
import { rolesApi, moduleGroupsApi, modulesApi } from '@/lib/users-api';
import type { RoleItem, Module, PermissionPair } from '@/lib/users-api';

type PermKey = string;

function toKey(moduleId: string, actionId: string): PermKey {
  return `${moduleId}:${actionId}`;
}

function fromKey(key: PermKey): PermissionPair {
  const [moduleId = '', actionId = ''] = key.split(':');
  return { moduleId, actionId };
}

// Internal: ModuleGroup enriched with full Module objects (including allowedActions)
export interface ModuleGroupView {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  modules: Module[];
}

export function useRoleConfig() {
  // ── Role list ─────────────────────────────────────────────────────────────
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);

  // ── Permission matrix ─────────────────────────────────────────────────────
  const [moduleGroups, setModuleGroups] = useState<ModuleGroupView[]>([]);
  const [checked, setChecked] = useState<Set<PermKey>>(new Set());
  const [originalChecked, setOriginalChecked] = useState<Set<PermKey>>(new Set());
  const [permLoading, setPermLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [editRole, setEditRole] = useState<RoleItem | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleItem | null>(null);

  // ── Load roles ────────────────────────────────────────────────────────────
  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const data = await rolesApi.list();
      setRoles(data.items);
    } catch {
      // non-fatal
    } finally {
      setRolesLoading(false);
    }
  }, []);

  // ── Load module groups + full modules (once) ──────────────────────────────
  useEffect(() => {
    loadRoles();

    Promise.all([
      moduleGroupsApi.list({ activeOnly: true }),
      modulesApi.list({ activeOnly: true }),
    ]).then(([groupsRes, modulesRes]) => {
      // Build moduleId → Module map for O(1) lookup
      const moduleMap = new Map<string, Module>(
        modulesRes.items.map(m => [m.id, m])
      );

      // Enrich each group with full Module objects (including allowedActions)
      const enriched: ModuleGroupView[] = groupsRes.items
        .map(g => ({
          id: g.id,
          code: g.code,
          name: g.name,
          sortOrder: g.sortOrder,
          modules: g.modules
            .map(s => moduleMap.get(s.id))
            .filter((m): m is Module => !!m)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }))
        .filter(g => g.modules.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      setModuleGroups(enriched);
    }).catch(() => {});
  }, [loadRoles]);

  // ── Select role → load grants ─────────────────────────────────────────────
  const handleSelectRole = useCallback(async (role: RoleItem) => {
    setSelectedRole(role);
    setPermLoading(true);
    setError('');
    setChecked(new Set());
    setOriginalChecked(new Set());
    try {
      const detail = await rolesApi.get(role.id);
      const set = new Set<PermKey>();
      (detail.grants ?? []).forEach(p => set.add(toKey(p.moduleId, p.actionId)));
      setChecked(set);
      setOriginalChecked(new Set(set));
      setSelectedRole(detail);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setPermLoading(false);
    }
  }, []);

  // ── Permission cell helpers ───────────────────────────────────────────────
  function toggleCell(moduleId: string, actionId: string) {
    const key = toKey(moduleId, actionId);
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Toggle ALL allowedActions of a single module on/off
  function toggleModuleAll(module: Module) {
    const keys = module.allowedActions.map(a => toKey(module.id, a.id));
    const allChecked = keys.length > 0 && keys.every(k => checked.has(k));
    setChecked(prev => {
      const next = new Set(prev);
      if (allChecked) keys.forEach(k => next.delete(k));
      else keys.forEach(k => next.add(k));
      return next;
    });
  }

  // Granted/total + checked/indeterminate state for one module
  function moduleState(module: Module) {
    const total = module.allowedActions.length;
    const granted = module.allowedActions.filter(a => checked.has(toKey(module.id, a.id))).length;
    return {
      granted,
      total,
      checked: total > 0 && granted === total,
      indeterminate: granted > 0 && granted < total,
    };
  }

  // Toggle EVERY (module, action) permission within a group on/off
  function toggleGroupAll(group: ModuleGroupView) {
    const keys = group.modules.flatMap(m => m.allowedActions.map(a => toKey(m.id, a.id)));
    const allChecked = keys.length > 0 && keys.every(k => checked.has(k));
    setChecked(prev => {
      const next = new Set(prev);
      if (allChecked) keys.forEach(k => next.delete(k));
      else keys.forEach(k => next.add(k));
      return next;
    });
  }

  // Granted/total + checked/indeterminate state for one group
  function groupState(group: ModuleGroupView) {
    const keys = group.modules.flatMap(m => m.allowedActions.map(a => toKey(m.id, a.id)));
    const granted = keys.filter(k => checked.has(k)).length;
    return {
      granted,
      total: keys.length,
      checked: keys.length > 0 && granted === keys.length,
      indeterminate: granted > 0 && granted < keys.length,
    };
  }

  // Only select valid (module, action) pairs per allowedActions
  function selectAll() {
    const set = new Set<PermKey>();
    moduleGroups.forEach(g =>
      g.modules.forEach(m =>
        m.allowedActions.forEach(a => set.add(toKey(m.id, a.id)))
      )
    );
    setChecked(set);
  }

  function deselectAll() { setChecked(new Set()); }

  // ── Save permissions ──────────────────────────────────────────────────────
  async function savePermissions() {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const toAdd = [...checked].filter(k => !originalChecked.has(k)).map(fromKey);
      const toRemove = [...originalChecked].filter(k => !checked.has(k)).map(fromKey);
      await Promise.all([
        toAdd.length > 0 ? rolesApi.addPermissions(selectedRole.id, toAdd) : Promise.resolve(),
        toRemove.length > 0 ? rolesApi.removePermissions(selectedRole.id, toRemove) : Promise.resolve(),
      ]);
      setOriginalChecked(new Set(checked));
      setSuccessMsg('Đã lưu phân quyền thành công');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Modal callbacks ───────────────────────────────────────────────────────
  function onRoleCreated(r: RoleItem) {
    setRoles(prev => [...prev, r]);
    setShowCreate(false);
    handleSelectRole(r);
  }

  function onRoleUpdated(updated: RoleItem) {
    setRoles(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
    if (selectedRole?.id === updated.id) setSelectedRole(prev => ({ ...prev!, ...updated }));
    setEditRole(null);
  }

  function onRoleDeleted() {
    if (!deleteRole) return;
    setRoles(prev => prev.filter(r => r.id !== deleteRole.id));
    if (selectedRole?.id === deleteRole.id) {
      setSelectedRole(null);
      setChecked(new Set());
      setOriginalChecked(new Set());
    }
    setDeleteRole(null);
  }

  const isDirty =
    [...checked].some(k => !originalChecked.has(k)) ||
    [...originalChecked].some(k => !checked.has(k));

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  return {
    // role list
    roles: filteredRoles, rolesLoading,
    search, setSearch,
    selectedRole,
    // permission matrix
    moduleGroups, checked, originalChecked, permLoading, saving,
    // feedback
    error, successMsg,
    // modals
    showCreate, setShowCreate,
    editRole, setEditRole,
    deleteRole, setDeleteRole,
    // actions
    handleSelectRole,
    toggleCell,
    toggleModuleAll, moduleState,
    toggleGroupAll, groupState,
    selectAll, deselectAll,
    savePermissions,
    isDirty,
    // modal callbacks
    onRoleCreated, onRoleUpdated, onRoleDeleted,
  };
}
