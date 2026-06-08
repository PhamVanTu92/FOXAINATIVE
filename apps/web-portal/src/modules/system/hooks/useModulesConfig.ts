'use client';

import { useState, useEffect, useCallback } from 'react';
import { moduleGroupsApi, modulesApi, permissionActionsApi } from '@/lib/users-api';
import type { ModuleGroup, Module, PermissionAction } from '@/lib/users-api';

export type ConfigTab = 'actions' | 'groups' | 'modules';

export function useModulesConfig() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('actions');

  // ── Permission Actions (Section 11) ───────────────────────────────────────
  const [permActions, setPermActions] = useState<PermissionAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsSearch, setActionsSearch] = useState('');
  const [showCreateAction, setShowCreateAction] = useState(false);
  const [editAction, setEditAction] = useState<PermissionAction | null>(null);
  const [deleteAction, setDeleteAction] = useState<PermissionAction | null>(null);

  // ── Module Groups (Section 9) ─────────────────────────────────────────────
  const [groups, setGroups] = useState<ModuleGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsSearch, setGroupsSearch] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editGroup, setEditGroup] = useState<ModuleGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ModuleGroup | null>(null);

  // ── Modules (Section 10) ──────────────────────────────────────────────────
  const [modules, setModules] = useState<Module[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesSearch, setModulesSearch] = useState('');
  const [modulesGroupFilter, setModulesGroupFilter] = useState('');
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [deleteModule, setDeleteModule] = useState<Module | null>(null);

  // ── Load functions ────────────────────────────────────────────────────────
  const loadActions = useCallback(async () => {
    setActionsLoading(true);
    try {
      const res = await permissionActionsApi.list();
      setPermActions([...res.items].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch { /* non-fatal */ } finally { setActionsLoading(false); }
  }, []);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await moduleGroupsApi.list();
      setGroups([...res.items].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch { /* non-fatal */ } finally { setGroupsLoading(false); }
  }, []);

  const loadModules = useCallback(async () => {
    setModulesLoading(true);
    try {
      const res = await modulesApi.list();
      setModules([...res.items].sort((a, b) => {
        if (a.groupCode !== b.groupCode) return a.groupCode.localeCompare(b.groupCode);
        return a.sortOrder - b.sortOrder;
      }));
    } catch { /* non-fatal */ } finally { setModulesLoading(false); }
  }, []);

  useEffect(() => {
    loadActions();
    loadGroups();
    loadModules();
  }, [loadActions, loadGroups, loadModules]);

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredActions = permActions.filter(a =>
    !actionsSearch ||
    a.name.toLowerCase().includes(actionsSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(actionsSearch.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    !groupsSearch ||
    g.name.toLowerCase().includes(groupsSearch.toLowerCase()) ||
    g.code.toLowerCase().includes(groupsSearch.toLowerCase())
  );

  const filteredModules = modules.filter(m => {
    const matchSearch = !modulesSearch ||
      m.name.toLowerCase().includes(modulesSearch.toLowerCase()) ||
      m.code.toLowerCase().includes(modulesSearch.toLowerCase());
    const matchGroup = !modulesGroupFilter || m.groupId === modulesGroupFilter;
    return matchSearch && matchGroup;
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────
  function onActionCreated(a: PermissionAction) {
    setPermActions(prev => [...prev, a].sort((x, y) => x.sortOrder - y.sortOrder));
    setShowCreateAction(false);
  }

  function onActionUpdated(updated: PermissionAction) {
    setPermActions(prev => prev.map(a => a.id === updated.id ? updated : a));
    setEditAction(null);
  }

  function onActionDeleted() {
    if (!deleteAction) return;
    setPermActions(prev => prev.filter(a => a.id !== deleteAction.id));
    setDeleteAction(null);
  }

  function onGroupCreated(g: ModuleGroup) {
    setGroups(prev => [...prev, g].sort((x, y) => x.sortOrder - y.sortOrder));
    setShowCreateGroup(false);
  }

  function onGroupUpdated(updated: ModuleGroup) {
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    setEditGroup(null);
  }

  function onGroupDeleted() {
    if (!deleteGroup) return;
    setGroups(prev => prev.filter(g => g.id !== deleteGroup.id));
    setDeleteGroup(null);
  }

  function onModuleCreated(m: Module) {
    setModules(prev => [...prev, m].sort((x, y) => {
      if (x.groupCode !== y.groupCode) return x.groupCode.localeCompare(y.groupCode);
      return x.sortOrder - y.sortOrder;
    }));
    setShowCreateModule(false);
  }

  function onModuleUpdated(updated: Module) {
    setModules(prev => prev.map(m => m.id === updated.id ? updated : m));
    setEditModule(null);
  }

  function onModuleDeleted() {
    if (!deleteModule) return;
    setModules(prev => prev.filter(m => m.id !== deleteModule.id));
    setDeleteModule(null);
  }

  return {
    activeTab, setActiveTab,

    // permission actions
    permActions, actionsLoading, actionsSearch, setActionsSearch,
    filteredActions,
    showCreateAction, setShowCreateAction,
    editAction, setEditAction,
    deleteAction, setDeleteAction,
    onActionCreated, onActionUpdated, onActionDeleted,

    // module groups
    groups, groupsLoading, groupsSearch, setGroupsSearch,
    filteredGroups,
    showCreateGroup, setShowCreateGroup,
    editGroup, setEditGroup,
    deleteGroup, setDeleteGroup,
    onGroupCreated, onGroupUpdated, onGroupDeleted,

    // modules
    modules, modulesLoading, modulesSearch, setModulesSearch,
    modulesGroupFilter, setModulesGroupFilter,
    filteredModules,
    showCreateModule, setShowCreateModule,
    editModule, setEditModule,
    deleteModule, setDeleteModule,
    onModuleCreated, onModuleUpdated, onModuleDeleted,
  };
}
