'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  permissionsApi, moduleGroupsApi, permissionActionsApi,
  userRolesApi, rolesApi,
} from '@/lib/users-api';
import type { ModuleGroup, PermissionAction, RoleItem } from '@/lib/users-api';

type PermKey = string;

function toKey(moduleId: string, actionId: string): PermKey {
  return `${moduleId}:${actionId}`;
}

export function useUserPermissions(
  userId: string,
  userRoles: string[],
  onRolesChanged?: () => void,
) {
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [actions, setActions] = useState<PermissionAction[]>([]);
  const [checked, setChecked] = useState<Set<PermKey>>(new Set());
  const [roleGranted, setRoleGranted] = useState<Set<PermKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [roles, setRoles] = useState<string[]>(userRoles);
  const [allRoles, setAllRoles] = useState<RoleItem[]>([]);
  const [activeRole, setActiveRole] = useState(userRoles[0] ?? '');
  const [roleMutating, setRoleMutating] = useState(false);
  const [roleError, setRoleError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsRes, actionsRes, permsRes, rolesRes] = await Promise.all([
        moduleGroupsApi.list(),
        permissionActionsApi.list(),
        permissionsApi.getUser(userId),
        rolesApi.list(),
      ]);
      const sortedGroups = [...groupsRes.items].sort((a, b) => a.sortOrder - b.sortOrder);
      sortedGroups.forEach(g => g.modules.sort((a, b) => a.sortOrder - b.sortOrder));
      setModuleGroups(sortedGroups);
      setActions([...actionsRes.items].sort((a, b) => a.sortOrder - b.sortOrder));

      const roleSet = new Set<PermKey>();
      permsRes.roleGrants.forEach((p: { moduleId: string; actionId: string }) =>
        roleSet.add(toKey(p.moduleId, p.actionId))
      );
      setRoleGranted(roleSet);

      const effSet = new Set<PermKey>();
      permsRes.effective.forEach((p: { moduleId: string; actionId: string }) =>
        effSet.add(toKey(p.moduleId, p.actionId))
      );
      setChecked(effSet);

      setAllRoles(rolesRes.items);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch only permissions (after role assign/remove) without resetting the full loading state
  const reloadPermissions = useCallback(async () => {
    try {
      const permsRes = await permissionsApi.getUser(userId);

      const roleSet = new Set<PermKey>();
      permsRes.roleGrants.forEach((p: { moduleId: string; actionId: string }) =>
        roleSet.add(toKey(p.moduleId, p.actionId))
      );
      setRoleGranted(roleSet);

      const effSet = new Set<PermKey>();
      permsRes.effective.forEach((p: { moduleId: string; actionId: string }) =>
        effSet.add(toKey(p.moduleId, p.actionId))
      );
      setChecked(effSet);
    } catch {
      // silently ignore — role change already persisted
    }
  }, [userId]);

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

  function columnState(actionId: string): { checked: boolean; indeterminate: boolean } {
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

  async function assignRole(roleCode: string): Promise<void> {
    if (roles.includes(roleCode)) return;
    setRoleMutating(true);
    setRoleError('');
    try {
      await userRolesApi.assign(userId, roleCode);
      const next = [...roles, roleCode];
      setRoles(next);
      if (!activeRole) setActiveRole(roleCode);
      await reloadPermissions();
      onRolesChanged?.();
    } catch (e: unknown) {
      setRoleError((e as Error).message);
    } finally {
      setRoleMutating(false);
    }
  }

  async function removeRole(roleCode: string): Promise<void> {
    setRoleMutating(true);
    setRoleError('');
    try {
      await userRolesApi.remove(userId, roleCode);
      const next = roles.filter(r => r !== roleCode);
      setRoles(next);
      if (activeRole === roleCode) setActiveRole(next[0] ?? '');
      await reloadPermissions();
      onRolesChanged?.();
    } catch (e: unknown) {
      setRoleError((e as Error).message);
    } finally {
      setRoleMutating(false);
    }
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError('');
    try {
      const effectiveGrants = Array.from(checked).map(key => {
        const [moduleId = '', actionId = ''] = key.split(':');
        return { moduleId, actionId };
      });
      await permissionsApi.setUser(userId, effectiveGrants);
      return true;
    } catch (e: unknown) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  const availableRoles = allRoles.filter(r => !roles.includes(r.code));

  return {
    moduleGroups, actions, checked, roleGranted,
    loading, saving, error,
    roles, activeRole, setActiveRole,
    roleMutating, roleError, availableRoles,
    assignRole, removeRole,
    toggleCell, toggleColumn, columnState,
    selectAll, deselectAll,
    save,
  };
}
