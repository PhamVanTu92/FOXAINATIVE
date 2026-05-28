'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Key, Shield, Edit2, Trash2, AlertCircle,
  Loader2, CheckSquare, Square, X, Check,
} from 'lucide-react';
import { rolesApi } from '@/lib/users-api';
import type { RoleItem } from '@/lib/users-api';
import { useRoleConfig } from '../hooks/useRoleConfig';

// ─── Types ────────────────────────────────────────────────────────────────────
function toKey(moduleId: string, actionId: string) {
  return `${moduleId}:${actionId}`;
}

// ─── Avatar helpers ────────────────────────────────────────────────────────────
const ROLE_COLORS = [
  'bg-primary-500', 'bg-violet-500', 'bg-success-600',
  'bg-teal-500', 'bg-orange-500', 'bg-sky-500', 'bg-danger-500', 'bg-warning-600',
];
function roleColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return ROLE_COLORS[h % ROLE_COLORS.length];
}
function roleInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Indeterminate checkbox ────────────────────────────────────────────────────
function IndeterminateCheckbox({
  checked, indeterminate, onChange,
}: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
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

// ─── Role Form Modal ───────────────────────────────────────────────────────────
function RoleFormModal({
  role, onClose, onSaved,
}: {
  role?: RoleItem;
  onClose: () => void;
  onSaved: (r: RoleItem) => void;
}) {
  const [form, setForm] = useState({
    code: role?.code ?? '',
    name: role?.name ?? '',
    description: role?.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = role
        ? await rolesApi.update(role.id, { name: form.name, description: form.description })
        : await rolesApi.create({ code: form.code || undefined, name: form.name, description: form.description || undefined });
      onSaved(result);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">
            {role ? 'Sửa vai trò' : 'Thêm vai trò mới'}
          </h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {!role && (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                Mã vai trò
                <span className="text-content-muted font-normal ml-1">(để trống để tự tạo)</span>
              </label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="VD: KE_TOAN_TRUONG"
                className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Tên vai trò <span className="text-danger-600">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Quản trị hệ thống"
              required
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Mô tả</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả về vai trò này..."
              rows={3}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {role ? 'Lưu thay đổi' : 'Tạo vai trò'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({
  role, onClose, onDeleted,
}: {
  role: RoleItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setDeleting(true);
    setError('');
    try {
      await rolesApi.remove(role.id);
      onDeleted();
    } catch (err: unknown) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">Xóa vai trò</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-content-secondary">
            Bạn có chắc muốn xóa vai trò{' '}
            <strong className="text-content-primary">{role.name}</strong>?
            Hành động này không thể hoàn tác.
          </p>
          {role.isSystem && (
            <div className="mt-3 flex items-center gap-2 bg-warning-50/10 border border-warning-500/30 text-warning-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" />
              Đây là vai trò hệ thống, không nên xóa.
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-strong">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-60 transition-colors"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Xóa vai trò
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RoleConfigView() {
  const {
    roles, rolesLoading,
    search, setSearch,
    selectedRole,
    moduleGroups, actions, checked, permLoading, saving,
    error, successMsg,
    showCreate, setShowCreate,
    editRole, setEditRole,
    deleteRole, setDeleteRole,
    handleSelectRole,
    toggleCell, toggleColumn, columnState,
    selectAll, deselectAll,
    savePermissions,
    isDirty,
    onRoleCreated, onRoleUpdated, onRoleDeleted,
  } = useRoleConfig();

  return (
    <div className="flex h-full bg-subtle">

      {/* ── Left Panel ───────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-default bg-surface">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-default">
          <span className="text-sm font-semibold text-content-primary">Danh sách vai trò</span>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={12} /> Thêm
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-strong">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm vai trò..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content-primary"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {rolesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-content-muted" />
            </div>
          ) : roles.length === 0 ? (
            <p className="text-center text-xs text-content-muted py-10">Không có vai trò nào.</p>
          ) : (
            roles.map(role => {
              const isActive = selectedRole?.id === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => handleSelectRole(role)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors group relative ${
                    isActive
                      ? 'bg-primary-50 border-r-2 border-primary-500'
                      : 'hover:bg-subtle'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${roleColor(role.name)}`}>
                    {roleInitials(role.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-content-primary'}`}>
                      {role.name}
                    </p>
                    <p className="text-xs text-content-muted mt-0.5 font-mono">
                      {role.userCount !== undefined ? `${role.userCount} người dùng` : role.code}
                    </p>
                  </div>

                  {/* Hover actions */}
                  <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={e => { e.stopPropagation(); setEditRole(role); }}
                      className="p-1 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                      title="Sửa vai trò"
                    >
                      <Edit2 size={12} />
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteRole(role); }}
                        className="p-1 text-content-muted hover:text-danger-600 hover:bg-danger-50/10 rounded-md transition-colors"
                        title="Xóa vai trò"
                      >
                         <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedRole ? (
          <div className="flex-1 flex flex-col items-center justify-center text-content-muted gap-3">
            <Shield size={52} className="text-content-muted opacity-50" />
            <p className="text-sm">Chọn một vai trò để xem và chỉnh sửa phân quyền</p>
          </div>
        ) : (
          <>
            {/* Role header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-default bg-surface shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${roleColor(selectedRole.name)}`}>
                  <Key size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-content-primary">{selectedRole.name}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-warning-100 text-warning-700 font-mono">
                      {selectedRole.code}
                    </span>
                    {selectedRole.isSystem && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-100 text-primary-700">
                        Hệ thống
                      </span>
                    )}
                  </div>
                  {selectedRole.description && (
                    <p className="text-xs text-content-secondary mt-0.5">{selectedRole.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditRole(selectedRole)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
                >
                  <Edit2 size={14} /> Sửa vai trò
                </button>
                <button
                  onClick={savePermissions}
                  disabled={saving || permLoading || !isDirty}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  Lưu phân quyền
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-surface border-b border-strong shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-content-secondary">
                <Shield size={13} className="text-primary-500" />
                Thiết lập quyền truy cập cho vai trò. Click checkbox để bật/tắt từng quyền.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
                >
                  <CheckSquare size={12} /> Chọn tất cả
                </button>
                <button
                  onClick={deselectAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-default text-content-muted rounded-lg hover:bg-subtle transition-colors"
                >
                  <Square size={12} /> Bỏ tất cả
                </button>
              </div>
            </div>

            {/* Feedback */}
            {error && (
              <div className="mx-6 mt-3 flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-2 text-sm shrink-0">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}
            {successMsg && (
              <div className="mx-6 mt-3 flex items-center gap-2 bg-success-50/10 border border-success-500/30 text-success-700 rounded-lg px-4 py-2 text-sm shrink-0">
                <Check size={14} className="shrink-0" /> {successMsg}
              </div>
            )}

            {/* Permission Matrix */}
            <div className="flex-1 overflow-auto">
              {permLoading ? (
                <div className="flex items-center justify-center h-48 gap-2 text-content-muted text-sm">
                  <Loader2 size={18} className="animate-spin" /> Đang tải quyền hạn...
                </div>
              ) : moduleGroups.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-content-muted text-sm">
                  Chưa có phân hệ nào được cấu hình.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-subtle border-b border-default">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wide w-64">
                        Phân hệ / Module
                      </th>
                      {actions.map(action => {
                        const { checked: colChecked, indeterminate } = columnState(action.id);
                        return (
                          <th key={action.id} className="px-4 py-3 text-center text-xs font-semibold text-content-secondary uppercase tracking-wide min-w-[80px]">
                            <div className="flex flex-col items-center gap-1.5">
                              <span>{action.name}</span>
                              <IndeterminateCheckbox
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
                        {/* Group header */}
                        <tr className="bg-warning-50/10 border-b border-warning-500/30">
                          <td
                            colSpan={actions.length + 1}
                            className="px-5 py-2 text-xs font-semibold text-warning-600 uppercase tracking-wide"
                          >
                            {group.name}
                          </td>
                        </tr>
                        {/* Module rows */}
                        {group.modules.map(module => (
                          <tr
                            key={module.id}
                            className="border-b border-strong hover:bg-subtle transition-colors"
                          >
                            <td className="px-5 py-2.5 text-sm text-content-secondary">{module.name}</td>
                            {actions.map(action => {
                              const isChecked = checked.has(toKey(module.id, action.id));
                              return (
                                <td key={action.id} className="px-4 py-2.5 text-center">
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
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showCreate && (
        <RoleFormModal
          onClose={() => setShowCreate(false)}
          onSaved={onRoleCreated}
        />
      )}
      {editRole && (
        <RoleFormModal
          role={editRole}
          onClose={() => setEditRole(null)}
          onSaved={onRoleUpdated}
        />
      )}
      {deleteRole && (
        <DeleteConfirmModal
          role={deleteRole}
          onClose={() => setDeleteRole(null)}
          onDeleted={onRoleDeleted}
        />
      )}
    </div>
  );
}
