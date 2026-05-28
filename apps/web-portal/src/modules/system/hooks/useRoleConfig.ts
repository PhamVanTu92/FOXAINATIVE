'use client';

import { useState, useEffect, useCallback } from 'react';
import { rolesApi, moduleGroupsApi, permissionActionsApi } from '@/lib/users-api';
import type { RoleItem, ModuleGroup, PermissionAction, PermissionPair } from '@/lib/users-api';

type PermKey = string;

function toKey(moduleId: string, actionId: string): PermKey {
  return `${moduleId}:${actionId}`;
}

function fromKey(key: PermKey): PermissionPair {
  const [moduleId = '', actionId = ''] = key.split(':');
  return { moduleId, actionId };
}

export function useRoleConfig() {
  // ── Role list ─────────────────────────────────────────────────────────────
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);

  // ── Permission matrix ─────────────────────────────────────────────────────
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [actions, setActions] = useState<PermissionAction[]>([]);
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

  // ── Load module groups + actions (once) ───────────────────────────────────
  useEffect(() => {
    loadRoles();
    Promise.all([moduleGroupsApi.list(), permissionActionsApi.list()])
      .then(([groupsRes, actionsRes]) => {
        const sortedGroups = [...groupsRes.items].sort((a, b) => a.sortOrder - b.sortOrder);
        sortedGroups.forEach(g => g.modules.sort((a, b) => a.sortOrder - b.sortOrder));
        setModuleGroups(sortedGroups);
        setActions([...actionsRes.items].sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => {});
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

  function toggleColumn(actionId: string) {
    const allIds = moduleGroups.flatMap(g => g.modules.map(m => m.id));
    const allChecked = allIds.every(mId => checked.has(toKey(mId, actionId)));
    setChecked(prev => {
      const next = new Set(prev);
      if (allChecked) {
        allIds.forEach(mId => next.delete(toKey(mId, actionId)));
      } else {
        allIds.forEach(mId => next.add(toKey(mId, actionId)));
      }
      return next;
    });
  }

  function columnState(actionId: string) {
    const allIds = moduleGroups.flatMap(g => g.modules.map(m => m.id));
    if (allIds.length === 0) return { checked: false, indeterminate: false };
    const count = allIds.filter(mId => checked.has(toKey(mId, actionId))).length;
    return { checked: count === allIds.length, indeterminate: count > 0 && count < allIds.length };
  }

  function selectAll() {
    const set = new Set<PermKey>();
    moduleGroups.forEach(g => g.modules.forEach(m => actions.forEach(a => set.add(toKey(m.id, a.id)))));
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
    moduleGroups, actions, checked, permLoading, saving,
    // feedback
    error, successMsg,
    // modals
    showCreate, setShowCreate,
    editRole, setEditRole,
    deleteRole, setDeleteRole,
    // actions
    handleSelectRole,
    toggleCell, toggleColumn, columnState,
    selectAll, deselectAll,
    savePermissions,
    isDirty,
    // modal callbacks
    onRoleCreated, onRoleUpdated, onRoleDeleted,
  };
}
