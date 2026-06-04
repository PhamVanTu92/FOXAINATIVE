'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Key, AlertCircle, Loader2, Square, CheckSquare, Plus } from 'lucide-react';
import type { UserItem } from '@/lib/users-api';
import { useUserPermissions } from '../hooks/useUserPermissions';

function toKey(moduleId: string, actionId: string) {
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
  onRolesChanged,
}: {
  user: UserItem;
  onClose: () => void;
  onRolesChanged?: () => void;
}) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const {
    moduleGroups, actions, checked, roleGranted,
    loading, saving, error,
    roles, activeRole, setActiveRole,
    roleMutating, roleError, availableRoles,
    assignRole, removeRole,
    toggleCell, toggleColumn, columnState,
    selectAll, deselectAll,
    save,
  } = useUserPermissions(user.id, user.roles, onRolesChanged);

  async function handleSave() {
    const ok = await save();
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-default shrink-0">
          <div className="flex items-center gap-2 text-content-primary font-semibold">
            <Key size={16} className="text-primary-500" />
            Phân quyền: {user.fullName}
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-secondary">
            <X size={18} />
          </button>
        </div>

        {/* Role management */}
        <div className="flex items-start gap-3 px-6 py-3 bg-surface border-b border-default shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-h-[28px]">
            {roles.map(role => (
              <span
                key={role}
                className={`flex items-center gap-0.5 pl-2.5 pr-1 py-0.5 text-xs rounded-full font-medium transition-colors ${
                  activeRole === role
                    ? 'bg-primary-600 text-white'
                    : 'bg-primary-50 border border-primary-200 text-primary-700'
                }`}
              >
                <button
                  onClick={() => setActiveRole(role)}
                  className="leading-none py-0.5"
                  title="Xem quyền mặc định của vai trò này"
                >
                  {role}
                </button>
                <button
                  onClick={() => removeRole(role)}
                  disabled={roleMutating}
                  className={`ml-0.5 rounded-full p-0.5 transition-colors disabled:opacity-50 ${
                    activeRole === role
                      ? 'hover:bg-primary-500'
                      : 'hover:bg-primary-100'
                  }`}
                  title="Gỡ vai trò"
                >
                  <X size={10} />
                </button>
              </span>
            ))}

            {availableRoles.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowRoleDropdown(v => !v)}
                  disabled={roleMutating}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-dashed
                    border-dark-300 text-content-muted hover:border-primary-400 hover:text-primary-600
                    hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  {roleMutating
                    ? <Loader2 size={10} className="animate-spin" />
                    : <Plus size={10} />}
                  Gán vai trò
                </button>
                {showRoleDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(false)} />
                    <div className="absolute top-full left-0 mt-1 w-56 bg-surface rounded-lg shadow-lg
                      border border-default z-20 py-1 max-h-52 overflow-y-auto">
                      {availableRoles.map(r => (
                        <button
                          key={r.code}
                          onClick={() => { assignRole(r.code); setShowRoleDropdown(false); }}
                          className="w-full px-3 py-2 text-left hover:bg-subtle transition-colors"
                        >
                          <div className="text-xs font-medium text-content-primary">{r.code}</div>
                          {r.name && <div className="text-xs text-content-muted">{r.name}</div>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {roles.length === 0 && !availableRoles.length && (
              <span className="text-xs text-content-muted italic">Chưa có vai trò nào</span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
            <span className="text-xs text-content-muted">
              Phân quyền cá nhân sẽ ghi đè quyền mặc định của vai trò
            </span>
            <span className="text-xs text-content-muted">Click ô để bật/tắt</span>
            <span className="flex items-center gap-1 text-xs text-content-muted">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-100 border border-primary-300 shrink-0" />
              Quyền từ vai trò
            </span>
          </div>
        </div>

        {/* Role error */}
        {roleError && (
          <div className="flex items-center gap-2 mx-6 mt-2 text-sm bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 shrink-0">
            <AlertCircle size={14} className="shrink-0" /> {roleError}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-content-muted text-sm">
              <Loader2 size={18} className="animate-spin" /> Đang tải quyền hạn...
            </div>
          ) : moduleGroups.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-content-muted text-sm">
              Chưa có phân hệ nào được cấu hình.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-default">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-56">
                    Phân hệ / Module
                  </th>
                  {actions.map(action => {
                    const { checked: colChecked, indeterminate } = columnState(action.id);
                    return (
                      <th key={action.id} className="px-3 py-3 text-center text-xs font-semibold text-primary-600 uppercase tracking-wide w-20">
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
                    <tr className="bg-warning-50/10 border-b border-warning-500/30">
                      <td
                        colSpan={actions.length + 1}
                        className="px-4 py-2 text-xs font-semibold text-warning-600 uppercase tracking-wide"
                      >
                        {group.name}
                      </td>
                    </tr>
                    {group.modules.map(module => (
                      <tr key={module.id} className="border-b border-strong hover:bg-subtle/60 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-content-secondary">{module.name}</td>
                        {actions.map(action => {
                          const key = toKey(module.id, action.id);
                          const isChecked = checked.has(key);
                          const isFromRole = roleGranted.has(key);
                          return (
                            <td
                              key={action.id}
                              className={`px-3 py-2.5 text-center relative transition-colors ${
                                isFromRole ? 'bg-primary-50' : ''
                              }`}
                              title={isFromRole ? 'Quyền được cấp từ vai trò' : undefined}
                            >
                              {isFromRole && (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary-400" />
                              )}
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

        {/* Permission error */}
        {error && (
          <div className="flex items-center gap-2 mx-6 my-2 text-sm bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 shrink-0">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-strong bg-subtle shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-surface transition-colors"
          >
            <X size={14} /> Hủy
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
            >
              <CheckSquare size={14} /> Chọn tất cả
            </button>
            <button
              onClick={deselectAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-muted rounded-lg hover:bg-subtle transition-colors"
            >
              <Square size={14} /> Bỏ tất cả
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
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
