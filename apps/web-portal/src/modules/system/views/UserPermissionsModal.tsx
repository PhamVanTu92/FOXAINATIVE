'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Key, AlertCircle, Loader2, Square } from 'lucide-react';
import { permissionsApi, moduleGroupsApi, permissionActionsApi } from '@/lib/users-api';
import type { UserItem, ModuleGroup, PermissionAction } from '@/lib/users-api';

// ─── Types ────────────────────────────────────────────────────────────────────
type PermKey = string; // `${moduleId}:${actionId}`

function toKey(moduleId: string, actionId: string): PermKey {
  return `${moduleId}:${actionId}`;
}

// ─── Indeterminate checkbox ───────────────────────────────────────────────────
function Checkbox({
  checked, indeterminate, onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
    />
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function UserPermissionsModal({
  user,
  onClose,
}: {
  user: UserItem;
  onClose: () => void;
}) {
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [actions, setActions] = useState<PermissionAction[]>([]);
  const [checked, setChecked] = useState<Set<PermKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeRole, setActiveRole] = useState(user.roles[0] ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsRes, actionsRes, permsRes] = await Promise.all([
        moduleGroupsApi.list(),
        permissionActionsApi.list(),
        permissionsApi.getUser(user.id),
      ]);

      const sortedGroups = [...groupsRes.items].sort((a, b) => a.sortOrder - b.sortOrder);
      sortedGroups.forEach(g => g.modules.sort((a, b) => a.sortOrder - b.sortOrder));

      const sortedActions = [...actionsRes.items].sort((a, b) => a.sortOrder - b.sortOrder);

      setModuleGroups(sortedGroups);
      setActions(sortedActions);

      const set = new Set<PermKey>();
      permsRes.effective.forEach(p => set.add(toKey(p.moduleId, p.actionId)));
      setChecked(set);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  // ── Cell toggle ──────────────────────────────────────────────────────────────
  function toggleCell(moduleId: string, actionId: string) {
    const key = toKey(moduleId, actionId);
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Column (action) header toggle ────────────────────────────────────────────
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

  // ── Column state for header checkbox ────────────────────────────────────────
  function columnState(actionId: string): { checked: boolean; indeterminate: boolean } {
    const allIds = moduleGroups.flatMap(g => g.modules.map(m => m.id));
    if (allIds.length === 0) return { checked: false, indeterminate: false };
    const count = allIds.filter(mId => checked.has(toKey(mId, actionId))).length;
    return { checked: count === allIds.length, indeterminate: count > 0 && count < allIds.length };
  }

  // ── Select all / deselect all ────────────────────────────────────────────────
  function selectAll() {
    const set = new Set<PermKey>();
    moduleGroups.forEach(g => g.modules.forEach(m => actions.forEach(a => set.add(toKey(m.id, a.id)))));
    setChecked(set);
  }

  function deselectAll() {
    setChecked(new Set());
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    setError('');
    try {
      const effectiveGrants = Array.from(checked).map(key => {
        const [moduleId, actionId] = key.split(':');
        return { moduleId, actionId };
      });
      await permissionsApi.setUser(user.id, effectiveGrants);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200 shrink-0">
          <div className="flex items-center gap-2 text-dark-800 font-semibold">
            <Key size={16} className="text-primary-500" />
            Phân quyền: {user.fullName}
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600">
            <X size={18} />
          </button>
        </div>

        {/* Role tabs + hint */}
        {user.roles.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-3 border-b border-dark-200 bg-dark-50 shrink-0">
            <div className="flex items-center gap-1.5">
              {user.roles.map(role => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    activeRole === role
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-dark-200 text-dark-600 hover:bg-dark-100'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
            <span className="text-xs text-dark-400 ml-2">
              Phân quyền cá nhân sẽ ghi đè quyền mặc định của vai trò
            </span>
            <span className="text-xs text-dark-300 ml-auto">Click ô để bật/tắt</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-dark-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Đang tải quyền hạn...
            </div>
          ) : moduleGroups.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-dark-400 text-sm">
              Chưa có phân hệ nào được cấu hình.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-primary-50 border-b border-dark-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 w-56">
                    Phân hệ / Module
                  </th>
                  {actions.map(action => {
                    const { checked: colChecked, indeterminate } = columnState(action.id);
                    return (
                      <th key={action.id} className="px-3 py-3 text-center text-xs font-semibold text-dark-600 w-20">
                        <div className="flex flex-col items-center gap-1.5">
                          <span>{action.name}</span>
                          <Checkbox
                            checked={colChecked}
                            indeterminate={indeterminate}
                            onChange={() => toggleColumn(action.id)}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {moduleGroups.map(group => (
                  <React.Fragment key={group.id}>
                    {/* Group header row */}
                    <tr className="bg-dark-50">
                      <td
                        colSpan={actions.length + 1}
                        className="px-4 py-2 text-xs font-semibold text-primary-600 uppercase tracking-wide"
                      >
                        {group.name}
                      </td>
                    </tr>
                    {/* Module rows */}
                    {group.modules.map(module => (
                      <tr key={module.id} className="border-b border-dark-100 hover:bg-primary-50/30 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-dark-700">{module.name}</td>
                        {actions.map(action => {
                          const isChecked = checked.has(toKey(module.id, action.id));
                          return (
                            <td key={action.id} className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleCell(module.id, action.id)}
                                className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mx-6 my-2 text-sm bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-3 py-2 shrink-0">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-100 bg-dark-50 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-white transition-colors"
          >
            <X size={14} /> Hủy
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
            >
              ✓ Chọn tất cả
            </button>
            <button
              onClick={deselectAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-100 transition-colors"
            >
              <Square size={14} /> Bỏ tất cả
            </button>
            <button
              onClick={save}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-primary text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-60 transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              Lưu phân quyền
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
