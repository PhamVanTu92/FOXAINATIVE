'use client';

import { useState, useEffect, useCallback } from 'react';
import { permissionsApi, moduleGroupsApi, permissionActionsApi } from '@/lib/users-api';
import type { ModuleGroup, PermissionAction } from '@/lib/users-api';

type PermKey = string;

function toKey(moduleId: string, actionId: string): PermKey {
  return `${moduleId}:${actionId}`;
}

export function useUserPermissions(userId: string, userRoles: string[]) {
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [actions, setActions] = useState<PermissionAction[]>([]);
  const [checked, setChecked] = useState<Set<PermKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeRole, setActiveRole] = useState(userRoles[0] ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsRes, actionsRes, permsRes] = await Promise.all([
        moduleGroupsApi.list(),
        permissionActionsApi.list(),
        permissionsApi.getUser(userId),
      ]);
      const sortedGroups = [...groupsRes.items].sort((a, b) => a.sortOrder - b.sortOrder);
      sortedGroups.forEach(g => g.modules.sort((a, b) => a.sortOrder - b.sortOrder));
      setModuleGroups(sortedGroups);
      setActions([...actionsRes.items].sort((a, b) => a.sortOrder - b.sortOrder));
      const set = new Set<PermKey>();
      permsRes.effective.forEach((p: { moduleId: string; actionId: string }) =>
        set.add(toKey(p.moduleId, p.actionId))
      );
      setChecked(set);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

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

  return {
    moduleGroups, actions, checked,
    loading, saving, error,
    activeRole, setActiveRole,
    toggleCell, toggleColumn, columnState,
    selectAll, deselectAll,
    save,
  };
}
