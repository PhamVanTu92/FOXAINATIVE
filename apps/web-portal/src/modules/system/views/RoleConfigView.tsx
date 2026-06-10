'use client';

import React, { useState } from 'react';
import {
  Plus, Search, Key, Shield, Edit2, Trash2, AlertCircle,
  Loader2, X, Check, Minus, ChevronRight,
} from 'lucide-react';
import { rolesApi } from '@/lib/users-api';
import type { RoleItem } from '@/lib/users-api';
import { useRoleConfig } from '../hooks/useRoleConfig';
import { useRoutePermission } from '@/hooks/usePermission';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toKey(moduleId: string, actionId: string) { return `${moduleId}:${actionId}`; }

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

// ─── Action chip ───────────────────────────────────────────────────────────────
// One togglable permission (module × action). Shows diff vs original:
// newly added = green ring, newly removed = red dashed outline.
function ActionChip({
  name, checked, wasChecked, onChange,
}: {
  name: string;
  checked: boolean;
  wasChecked: boolean;
  onChange: () => void;
}) {
  const added   = checked && !wasChecked;
  const removed = !checked && wasChecked;

  const cls = checked
    ? added
      ? 'bg-primary-600 border-primary-600 text-white ring-2 ring-success-400/70 ring-offset-1 shadow-sm'
      : 'bg-primary-600 border-primary-600 text-white shadow-sm hover:bg-primary-700'
    : removed
      ? 'bg-danger-50 border-danger-300 text-danger-600 border-dashed ring-1 ring-danger-200'
      : 'bg-surface border-dark-200 text-content-secondary hover:border-primary-400 hover:bg-primary-50';

  return (
    <button
      type="button"
      onClick={onChange}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-150 ${cls}`}
    >
      {checked
        ? <Check size={11} strokeWidth={3} />
        : removed
          ? <Minus size={11} strokeWidth={3} />
          : null
      }
      {name}
    </button>
  );
}

// Module-level tri-state checkbox (primary tint) — selects all actions of a module
function CardCheckbox({
  checked, indeterminate, onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      onClick={onChange}
      title={active ? 'Bỏ chọn toàn bộ quyền của phân hệ này' : 'Chọn toàn bộ quyền của phân hệ này'}
      className={[
        'mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-all border-2 shrink-0',
        active
          ? 'bg-primary-600 border-primary-600 hover:bg-primary-700 shadow-sm'
          : 'bg-surface border-dark-200 hover:border-primary-500 hover:bg-primary-50',
      ].join(' ')}
    >
      {indeterminate && !checked
        ? <Minus size={11} strokeWidth={3} className="text-white" />
        : checked
          ? <Check size={11} strokeWidth={3} className="text-white" />
          : null
      }
    </button>
  );
}

// Group-level checkbox — orange/warning tinted to distinguish from global col header
function GroupColBox({
  checked, indeterminate, onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      onClick={onChange}
      title={active ? 'Bỏ chọn cả nhóm này' : 'Chọn cả nhóm này'}
      className={[
        'w-4 h-4 rounded flex items-center justify-center transition-all border-2',
        active
          ? 'bg-warning-500 border-warning-500 hover:bg-warning-600 shadow-sm'
          : 'bg-white border-warning-300 hover:border-warning-500 hover:bg-warning-50',
      ].join(' ')}
    >
      {indeterminate && !checked
        ? <Minus size={9} strokeWidth={3} className="text-white" />
        : checked
          ? <Check size={9} strokeWidth={3} className="text-white" />
          : null
      }
    </button>
  );
}

// ─── Role Form Modal ───────────────────────────────────────────────────────────
function RoleFormModal({ role, onClose, onSaved }: {
  role?: RoleItem; onClose: () => void; onSaved: (r: RoleItem) => void;
}) {
  const [form, setForm] = useState({
    code: role?.code ?? '', name: role?.name ?? '', description: role?.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const result = role
        ? await rolesApi.update(role.id, { name: form.name, description: form.description })
        : await rolesApi.create({ code: form.code || undefined, name: form.name, description: form.description || undefined });
      onSaved(result);
    } catch (err: unknown) { setError((err as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">{role ? 'Sửa vai trò' : 'Thêm vai trò mới'}</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {!role && (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                Mã vai trò
                <span className="text-content-muted font-normal ml-1 text-xs">(để trống để tự tạo)</span>
              </label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="VD: KE_TOAN_TRUONG"
                className="w-full border border-default rounded-lg px-3 py-2 text-sm font-mono text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
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
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
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
function DeleteConfirmModal({ role, onClose, onDeleted }: {
  role: RoleItem; onClose: () => void; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setDeleting(true); setError('');
    try { await rolesApi.remove(role.id); onDeleted(); }
    catch (err: unknown) { setError((err as Error).message); setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">Xóa vai trò</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-content-secondary">
            Bạn có chắc muốn xóa vai trò{' '}
            <strong className="text-content-primary">{role.name}</strong>?
            Hành động này không thể hoàn tác.
          </p>
          {role.isSystem && (
            <div className="flex items-center gap-2 bg-warning-50/10 border border-warning-500/30 text-warning-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> Đây là vai trò hệ thống.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-strong">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
            Hủy
          </button>
          <button onClick={confirm} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-60 transition-colors">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Xóa vai trò
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Unsaved Changes Warning Modal ────────────────────────────────────────────
function UnsavedChangesModal({
  onDiscard, onSaveFirst, onCancel,
}: {
  onDiscard: () => void;
  onSaveFirst: () => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try { await onSaveFirst(); }
    catch { /* error shown in main view */ }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-warning-100 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle size={18} className="text-warning-600" />
            </div>
            <div>
              <h3 className="font-semibold text-content-primary">Có thay đổi chưa lưu</h3>
              <p className="text-sm text-content-secondary mt-1">
                Nếu chuyển sang vai trò khác, các thay đổi phân quyền hiện tại sẽ bị mất.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-strong">
          <button onClick={onCancel}
            className="px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
            Ở lại
          </button>
          <button onClick={onDiscard}
            className="px-3 py-2 text-sm border border-danger-200 text-danger-600 rounded-lg hover:bg-danger-50 transition-colors">
            Bỏ thay đổi
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
            Lưu rồi chuyển
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RoleConfigView() {
  const {
    roles, rolesLoading, search, setSearch, selectedRole,
    moduleGroups, checked, originalChecked, permLoading, saving,
    error, successMsg,
    showCreate, setShowCreate, editRole, setEditRole, deleteRole, setDeleteRole,
    handleSelectRole, toggleCell,
    toggleModuleAll, moduleState,
    toggleGroupAll, groupState,
    selectAll, deselectAll, savePermissions, isDirty,
    onRoleCreated, onRoleUpdated, onRoleDeleted,
  } = useRoleConfig();

  const canCreate = useRoutePermission('CREATE');
  const canUpdate = useRoutePermission('UPDATE');
  const canDelete = useRoutePermission('DELETE');

  // Pending role switch (warn if dirty)
  const [pendingRole, setPendingRole] = useState<RoleItem | null>(null);
  function onRoleClick(role: RoleItem) {
    if (isDirty && selectedRole && selectedRole.id !== role.id) {
      setPendingRole(role);
    } else {
      handleSelectRole(role);
    }
  }

  // Search within matrix
  const [matrixSearch, setMatrixSearch] = useState('');

  // Collapsible groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  function toggleGroup(groupId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }
  function collapseAll() {
    setCollapsedGroups(new Set(moduleGroups.map(g => g.id)));
  }
  function expandAll() {
    setCollapsedGroups(new Set());
  }
  const allCollapsed = moduleGroups.length > 0 && collapsedGroups.size === moduleGroups.length;

  // When search is active, always show rows (ignore collapse state)
  const isCollapsed = (groupId: string) => !matrixSearch && collapsedGroups.has(groupId);
  const visibleModules = (groupId: string, modules: typeof moduleGroups[0]['modules']) =>
    !matrixSearch ? modules : modules.filter(m =>
      m.name.toLowerCase().includes(matrixSearch.toLowerCase())
    );
  const visibleGroups = !matrixSearch
    ? moduleGroups
    : moduleGroups.filter(g => g.modules.some(m =>
        m.name.toLowerCase().includes(matrixSearch.toLowerCase())
      ));

  // Stats
  const totalGranted  = checked.size;
  const addedCount    = [...checked].filter(k => !originalChecked.has(k)).length;
  const removedCount  = [...originalChecked].filter(k => !checked.has(k)).length;
  const totalModules  = moduleGroups.reduce((n, g) => n + g.modules.length, 0);

  return (
    <div className="flex h-full bg-subtle">

      {/* ── Left Panel — Role list ──────────────────────────────────── */}
      <div className="w-[17rem] shrink-0 flex flex-col border-r border-default bg-surface">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-default">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-primary-500" />
            <span className="text-sm font-semibold text-content-primary">Vai trò</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-dark-100 text-dark-500 font-medium">{roles.length}</span>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={12} /> Thêm
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-strong">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm vai trò..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
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
                  onClick={() => onRoleClick(role)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors group relative ${
                    isActive ? 'bg-primary-50 border-r-2 border-primary-500' : 'hover:bg-subtle'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${roleColor(role.name)}`}>
                    {roleInitials(role.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-content-primary'}`}>
                      {role.name}
                    </p>
                    <p className="text-xs text-content-muted mt-0.5 font-mono truncate">{role.code}</p>
                  </div>
                  {(canUpdate || canDelete) && (
                    <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {canUpdate && (
                        <button
                          onClick={e => { e.stopPropagation(); setEditRole(role); }}
                          className="p-1 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                          title="Sửa vai trò"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                      {canDelete && !role.isSystem && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteRole(role); }}
                          className="p-1 text-content-muted hover:text-danger-600 hover:bg-danger-50/10 rounded-md transition-colors"
                          title="Xóa vai trò"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedRole ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="p-5 rounded-2xl bg-dark-100/60">
              <Shield size={40} className="text-dark-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-content-primary">Chọn vai trò để xem phân quyền</p>
              <p className="text-xs text-content-muted mt-1">Mỗi vai trò có tập hợp quyền truy cập riêng trên từng phân hệ</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Role header ─────────────────────────────────────── */}
            <div className="bg-surface border-b border-default shrink-0">
              {/* Top row: info + buttons */}
              <div className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 ${roleColor(selectedRole.name)}`}>
                    {roleInitials(selectedRole.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-content-primary">{selectedRole.name}</h2>
                      <code className="text-xs px-2 py-0.5 rounded bg-dark-100 text-dark-600 border border-dark-200 font-mono">
                        {selectedRole.code}
                      </code>
                      {selectedRole.isSystem && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-100 text-primary-700">Hệ thống</span>
                      )}
                    </div>
                    {selectedRole.description && (
                      <p className="text-xs text-content-secondary mt-0.5">{selectedRole.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canUpdate && (
                    <button
                      onClick={() => setEditRole(selectedRole)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
                    >
                      <Edit2 size={13} /> Sửa vai trò
                    </button>
                  )}
                  {canUpdate && (
                    <button
                      onClick={savePermissions}
                      disabled={saving || permLoading || !isDirty}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        isDirty
                          ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                          : 'bg-dark-100 text-dark-400 cursor-not-allowed'
                      } disabled:opacity-60`}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                      Lưu phân quyền
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom row: stats + quick actions */}
              <div className="flex items-center justify-between px-6 py-2 bg-dark-50/60 border-t border-strong">
                <div className="flex items-center gap-4 text-xs">
                  {/* Permission count */}
                  <span className="flex items-center gap-1.5 text-content-secondary">
                    <Key size={11} className="text-primary-500" />
                    <span className="font-semibold text-primary-600">{totalGranted}</span>
                    <span>quyền / {totalModules} phân hệ</span>
                  </span>

                  {/* Unsaved diff indicator */}
                  {isDirty && (
                    <span className="flex items-center gap-1.5 text-warning-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
                      Chưa lưu:
                      {addedCount > 0 && (
                        <span className="flex items-center gap-0.5 text-success-600">
                          <Plus size={10} strokeWidth={3} />{addedCount}
                        </span>
                      )}
                      {removedCount > 0 && (
                        <span className="flex items-center gap-0.5 text-danger-600">
                          <Minus size={10} strokeWidth={3} />{removedCount}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Search within matrix */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    value={matrixSearch}
                    onChange={e => setMatrixSearch(e.target.value)}
                    placeholder="Tìm phân hệ..."
                    className="pl-8 pr-3 py-1 text-xs border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary w-36"
                  />
                  {matrixSearch && (
                    <button
                      onClick={() => setMatrixSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Collapse/expand all groups */}
                  <button
                    onClick={allCollapsed ? expandAll : collapseAll}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs border border-default text-content-secondary rounded-lg hover:bg-surface transition-colors"
                    title={allCollapsed ? 'Mở tất cả nhóm' : 'Đóng tất cả nhóm'}
                  >
                    <ChevronRight size={11} className={`transition-transform ${allCollapsed ? '' : 'rotate-90'}`} />
                    {allCollapsed ? 'Mở tất cả' : 'Đóng tất cả'}
                  </button>
                  <div className="w-px h-4 bg-dark-200" />
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs border border-default text-content-secondary rounded-lg hover:bg-surface transition-colors"
                  >
                    <Check size={11} strokeWidth={3} /> Chọn tất cả
                  </button>
                  <button
                    onClick={deselectAll}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs border border-default text-content-muted rounded-lg hover:bg-surface transition-colors"
                  >
                    <X size={11} /> Bỏ chọn
                  </button>
                </div>
              </div>
            </div>

            {/* Feedback */}
            {error && (
              <div className="mx-6 mt-3 flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-2 text-sm shrink-0">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}
            {successMsg && (
              <div className="mx-6 mt-3 flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 rounded-lg px-4 py-2 text-sm shrink-0">
                <Check size={14} className="shrink-0" /> {successMsg}
              </div>
            )}

            {/* ── Permission Matrix ────────────────────────────────── */}
            <div className="flex-1 overflow-auto">
              {permLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-content-muted">
                  <Loader2 size={24} className="animate-spin text-primary-400" />
                  <span className="text-sm">Đang tải phân quyền...</span>
                </div>
              ) : moduleGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Shield size={32} className="text-dark-200" />
                  <span className="text-sm text-content-muted">Chưa có phân hệ nào được cấu hình.</span>
                </div>
              ) : visibleGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Search size={28} className="text-dark-200" />
                  <span className="text-sm text-content-muted">Không tìm thấy phân hệ phù hợp.</span>
                </div>
              ) : (
                <div className="px-6 py-5 space-y-4">
                  {visibleGroups.map(group => {
                    const gs        = groupState(group);
                    const collapsed = isCollapsed(group.id);
                    const modules   = visibleModules(group.id, group.modules);

                    return (
                      <section key={group.id} className="rounded-xl border border-default bg-surface overflow-hidden shadow-sm">
                        {/* Group header — select-all + name + count + collapse */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-warning-50 to-orange-50 border-b border-warning-200/70">
                          <GroupColBox
                            checked={gs.checked}
                            indeterminate={gs.indeterminate}
                            onChange={() => toggleGroupAll(group)}
                          />
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left select-none"
                          >
                            <ChevronRight
                              size={14}
                              className={`text-warning-500 transition-transform duration-150 shrink-0 ${collapsed ? '' : 'rotate-90'}`}
                            />
                            <span className="text-xs font-bold text-warning-700 uppercase tracking-widest truncate">{group.name}</span>
                            <span className="text-xs text-warning-500/80 shrink-0">({group.modules.length} phân hệ)</span>
                          </button>
                          {gs.total > 0 && (
                            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                              gs.checked
                                ? 'bg-success-100 text-success-700'
                                : gs.granted > 0
                                  ? 'bg-primary-100 text-primary-700'
                                  : 'bg-dark-100 text-dark-400'
                            }`}>
                              {gs.granted} / {gs.total}
                            </span>
                          )}
                        </div>

                        {/* Module cards — hidden when collapsed */}
                        {!collapsed && (
                          <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {modules.map(module => {
                              const ms = moduleState(module);
                              return (
                                <div
                                  key={module.id}
                                  className={`rounded-lg border p-3 transition-colors ${
                                    ms.checked
                                      ? 'border-primary-200 bg-primary-50/40'
                                      : ms.indeterminate
                                        ? 'border-primary-100 bg-primary-50/20'
                                        : 'border-dark-200 bg-surface hover:border-primary-200'
                                  }`}
                                >
                                  {/* Card header: select-all + name + code + count */}
                                  <div className="flex items-start gap-2.5 mb-2.5">
                                    <CardCheckbox
                                      checked={ms.checked}
                                      indeterminate={ms.indeterminate}
                                      onChange={() => toggleModuleAll(module)}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-content-primary leading-snug">{module.name}</p>
                                      <p className="text-xs text-content-muted font-mono truncate mt-0.5">{module.code}</p>
                                    </div>
                                    {ms.total > 0 && (
                                      <span className={`shrink-0 text-xs font-medium tabular-nums ${
                                        ms.checked ? 'text-success-600' : ms.granted > 0 ? 'text-primary-500' : 'text-content-muted'
                                      }`}>
                                        {ms.granted}/{ms.total}
                                      </span>
                                    )}
                                  </div>

                                  {/* Action chips — only the actions this module supports */}
                                  <div className="flex flex-wrap gap-1.5 pl-[1.625rem]">
                                    {module.allowedActions.map(action => (
                                      <ActionChip
                                        key={action.id}
                                        name={action.name}
                                        checked={checked.has(toKey(module.id, action.id))}
                                        wasChecked={originalChecked.has(toKey(module.id, action.id))}
                                        onChange={() => toggleCell(module.id, action.id)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showCreate && <RoleFormModal onClose={() => setShowCreate(false)} onSaved={onRoleCreated} />}
      {editRole   && <RoleFormModal role={editRole} onClose={() => setEditRole(null)} onSaved={onRoleUpdated} />}
      {deleteRole && <DeleteConfirmModal role={deleteRole} onClose={() => setDeleteRole(null)} onDeleted={onRoleDeleted} />}

      {/* Warn before switching role with unsaved changes */}
      {pendingRole && (
        <UnsavedChangesModal
          onDiscard={() => { handleSelectRole(pendingRole); setPendingRole(null); }}
          onSaveFirst={async () => { await savePermissions(); handleSelectRole(pendingRole); setPendingRole(null); }}
          onCancel={() => setPendingRole(null)}
        />
      )}
    </div>
  );
}
