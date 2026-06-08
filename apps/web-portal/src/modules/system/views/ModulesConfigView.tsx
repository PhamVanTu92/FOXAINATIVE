'use client';

import React, { useState } from 'react';
import {
  Plus, Search, Edit2, Trash2, AlertCircle, Loader2, X, Check,
  Layers, Boxes, Zap, ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  permissionActionsApi, moduleGroupsApi, modulesApi,
} from '@/lib/users-api';
import type {
  PermissionAction, ModuleGroup, Module,
  CreatePermissionActionPayload, UpdatePermissionActionPayload,
  CreateModuleGroupPayload, UpdateModuleGroupPayload,
  CreateModulePayload, UpdateModulePayload,
} from '@/lib/users-api';
import { useModulesConfig } from '../hooks/useModulesConfig';
import type { ConfigTab } from '../hooks/useModulesConfig';

// ─── Shared helpers ────────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-success-100 text-success-700">
      <ToggleRight size={11} /> Hoạt động
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-dark-100 text-dark-500">
      <ToggleLeft size={11} /> Vô hiệu
    </span>
  );
}

function DeleteConfirm({
  label, onClose, onConfirm,
}: { label: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setDeleting(true);
    setError('');
    try { await onConfirm(); }
    catch (e: unknown) { setError((e as Error).message); setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">Xác nhận xóa</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-content-secondary">
            Bạn có chắc muốn xóa <strong className="text-content-primary">{label}</strong>?
            Hành động này không thể hoàn tác.
          </p>
          {error && (
            <div className="mt-3 flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-strong">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
            Hủy
          </button>
          <button
            onClick={go}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-60 transition-colors"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Permission Action Form Modal ──────────────────────────────────────────────
function PermActionModal({
  action, onClose, onSaved,
}: {
  action?: PermissionAction;
  onClose: () => void;
  onSaved: (a: PermissionAction) => void;
}) {
  const [form, setForm] = useState<CreatePermissionActionPayload>({
    code: action?.code ?? '',
    name: action?.name ?? '',
    description: action?.description ?? '',
    sortOrder: action?.sortOrder ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = action
        ? await permissionActionsApi.update(action.id, {
            name: form.name,
            description: form.description || undefined,
            sortOrder: form.sortOrder,
          } as UpdatePermissionActionPayload)
        : await permissionActionsApi.create(form);
      onSaved(result);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">
            {action ? 'Sửa hành động phân quyền' : 'Thêm hành động phân quyền'}
          </h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {!action && (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                Mã hành động <span className="text-danger-600">*</span>
                <span className="text-content-muted font-normal ml-1 text-xs">(UPPER_SNAKE_CASE, max 32 ký tự)</span>
              </label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="VD: APPROVE"
                required
                maxLength={32}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm font-mono text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
              />
              <p className="mt-1 text-xs text-content-muted">Gợi ý: READ · CREATE · UPDATE · DELETE · APPROVE · UPLOAD · EXPORT · IMPORT</p>
            </div>
          )}
          {action && (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">Mã hành động</label>
              <input
                value={action.code}
                disabled
                className="w-full border border-default rounded-lg px-3 py-2 text-sm font-mono text-content-muted bg-subtle cursor-not-allowed"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Tên hiển thị <span className="text-danger-600">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Xem"
              required
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Mô tả</label>
            <input
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="VD: Xem danh sách và chi tiết"
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Thứ tự hiển thị <span className="text-danger-600">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
              required
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {action ? 'Lưu thay đổi' : 'Thêm hành động'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Module Group Form Modal ───────────────────────────────────────────────────
function ModuleGroupModal({
  group, onClose, onSaved,
}: {
  group?: ModuleGroup;
  onClose: () => void;
  onSaved: (g: ModuleGroup) => void;
}) {
  const [form, setForm] = useState<CreateModuleGroupPayload>({
    code: group?.code ?? '',
    name: group?.name ?? '',
    description: group?.description ?? '',
    sortOrder: group?.sortOrder ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = group
        ? await moduleGroupsApi.update(group.id, {
            name: form.name,
            description: form.description || undefined,
            sortOrder: form.sortOrder,
          } as UpdateModuleGroupPayload)
        : await moduleGroupsApi.create(form);
      onSaved(result);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">
            {group ? 'Sửa nhóm phân hệ' : 'Thêm nhóm phân hệ'}
          </h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {!group && (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                Mã nhóm <span className="text-danger-600">*</span>
                <span className="text-content-muted font-normal ml-1 text-xs">(UPPER_SNAKE_CASE, max 100 ký tự)</span>
              </label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="VD: QUAN_LY_HE_THONG"
                required
                maxLength={100}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm font-mono text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
              />
            </div>
          )}
          {group && (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">Mã nhóm</label>
              <input value={group.code} disabled className="w-full border border-default rounded-lg px-3 py-2 text-sm font-mono text-content-muted bg-subtle cursor-not-allowed" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Tên nhóm <span className="text-danger-600">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Quản lý hệ thống"
              required
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Mô tả</label>
            <input
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả chức năng nhóm này..."
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Thứ tự hiển thị <span className="text-danger-600">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
              required
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">Hủy</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {group ? 'Lưu thay đổi' : 'Thêm nhóm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Module Form Modal ─────────────────────────────────────────────────────────
function ModuleFormModal({
  module: mod, groups, allActions, onClose, onSaved,
}: {
  module?: Module;
  groups: ModuleGroup[];
  allActions: PermissionAction[];
  onClose: () => void;
  onSaved: (m: Module) => void;
}) {
  const [form, setForm] = useState<CreateModulePayload & { isActive?: boolean }>({
    groupId: mod?.groupId ?? (groups[0]?.id ?? ''),
    code: mod?.code ?? '',
    name: mod?.name ?? '',
    description: mod?.description ?? '',
    sortOrder: mod?.sortOrder ?? 0,
    actionIds: mod?.allowedActions.map(a => a.id) ?? [],
    isActive: mod?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleAction(id: string) {
    setForm(f => ({
      ...f,
      actionIds: f.actionIds?.includes(id)
        ? f.actionIds.filter(x => x !== id)
        : [...(f.actionIds ?? []), id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let result: Module;
      if (mod) {
        const payload: UpdateModulePayload = {
          groupId: form.groupId !== mod.groupId ? form.groupId : undefined,
          name: form.name,
          description: form.description || undefined,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
          updateActions: true,
          actionIds: form.actionIds,
        };
        result = await modulesApi.update(mod.id, payload);
      } else {
        result = await modulesApi.create({
          groupId: form.groupId,
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          sortOrder: form.sortOrder,
          actionIds: form.actionIds,
        });
      }
      onSaved(result);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default sticky top-0 bg-surface z-10">
          <h2 className="font-semibold text-content-primary">
            {mod ? 'Sửa phân hệ' : 'Thêm phân hệ mới'}
          </h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Group */}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Nhóm phân hệ <span className="text-danger-600">*</span>
            </label>
            <select
              value={form.groupId}
              onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}
              required
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface"
            >
              <option value="">-- Chọn nhóm --</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Code */}
          {!mod ? (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                Mã phân hệ <span className="text-danger-600">*</span>
                <span className="text-content-muted font-normal ml-1 text-xs">(UPPER_SNAKE_CASE)</span>
              </label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="VD: VAI_TRO"
                required
                maxLength={100}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm font-mono text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">Mã phân hệ</label>
              <input value={mod.code} disabled className="w-full border border-default rounded-lg px-3 py-2 text-sm font-mono text-content-muted bg-subtle cursor-not-allowed" />
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Tên phân hệ <span className="text-danger-600">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Cấu hình vai trò"
              required
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Mô tả</label>
            <input
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả chức năng phân hệ..."
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface"
            />
          </div>

          {/* Sort order + active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                Thứ tự <span className="text-danger-600">*</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                required
                className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface"
              />
            </div>
            {mod && (
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1">Trạng thái</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className="w-full flex items-center justify-center gap-2 border border-default rounded-lg px-3 py-2 text-sm hover:bg-subtle transition-colors"
                >
                  {form.isActive
                    ? <><ToggleRight size={16} className="text-success-600" /><span className="text-success-700">Hoạt động</span></>
                    : <><ToggleLeft size={16} className="text-dark-400" /><span className="text-content-muted">Vô hiệu</span></>
                  }
                </button>
              </div>
            )}
          </div>

          {/* Action IDs */}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">
              Hành động cho phép
              <span className="text-content-muted font-normal ml-1 text-xs">(hiển thị cột trong lưới phân quyền)</span>
            </label>
            {allActions.length === 0 ? (
              <p className="text-xs text-content-muted">Chưa có hành động nào. Thêm tại tab &quot;Hành động phân quyền&quot;.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {allActions.map(a => {
                  const selected = form.actionIds?.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-default bg-surface text-content-secondary hover:bg-subtle'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleAction(a.id)}
                        className="w-4 h-4 rounded accent-primary-600"
                      />
                      <span className="text-sm font-medium">{a.name}</span>
                      <code className="ml-auto text-xs font-mono opacity-60">{a.code}</code>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">Hủy</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {mod ? 'Lưu thay đổi' : 'Thêm phân hệ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({
  id, active, icon: Icon, label, count, onClick,
}: {
  id: ConfigTab; active: boolean; icon: React.ElementType; label: string; count: number;
  onClick: (id: ConfigTab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-content-muted hover:text-content-primary hover:border-dark-200'
      }`}
    >
      <Icon size={14} />
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-primary-100 text-primary-700' : 'bg-dark-100 text-dark-500'}`}>
        {count}
      </span>
    </button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function ModulesConfigView() {
  const {
    activeTab, setActiveTab,
    permActions, actionsLoading, actionsSearch, setActionsSearch, filteredActions,
    showCreateAction, setShowCreateAction, editAction, setEditAction, deleteAction, setDeleteAction,
    onActionCreated, onActionUpdated, onActionDeleted,
    groups, groupsLoading, groupsSearch, setGroupsSearch, filteredGroups,
    showCreateGroup, setShowCreateGroup, editGroup, setEditGroup, deleteGroup, setDeleteGroup,
    onGroupCreated, onGroupUpdated, onGroupDeleted,
    modules, modulesLoading, modulesSearch, setModulesSearch,
    modulesGroupFilter, setModulesGroupFilter, filteredModules,
    showCreateModule, setShowCreateModule, editModule, setEditModule, deleteModule, setDeleteModule,
    onModuleCreated, onModuleUpdated, onModuleDeleted,
  } = useModulesConfig();

  return (
    <div className="flex flex-col h-full bg-subtle">
      {/* Page header */}
      <div className="bg-surface border-b border-default px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold text-dark-800">Cấu hình phân hệ &amp; Phân quyền</h1>
        <p className="text-sm text-content-muted mt-0.5">
          Quản lý cấu trúc phân hệ, nhóm phân hệ và các hành động dùng trong lưới phân quyền vai trò.
        </p>
      </div>

      {/* Tab bar */}
      <div className="bg-surface border-b border-default px-6 flex gap-1 shrink-0">
        <TabBtn id="actions" active={activeTab === 'actions'} icon={Zap} label="Hành động phân quyền" count={permActions.length} onClick={setActiveTab} />
        <TabBtn id="groups" active={activeTab === 'groups'} icon={Boxes} label="Nhóm phân hệ" count={groups.length} onClick={setActiveTab} />
        <TabBtn id="modules" active={activeTab === 'modules'} icon={Layers} label="Phân hệ" count={modules.length} onClick={setActiveTab} />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">

        {/* ── Tab: Hành động phân quyền ──────────────────────────────── */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  value={actionsSearch}
                  onChange={e => setActionsSearch(e.target.value)}
                  placeholder="Tìm theo mã / tên..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
                />
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowCreateAction(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={14} /> Thêm hành động
              </button>
            </div>

            {/* Table */}
            <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-50 border-b border-default">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-32">Mã</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Tên hiển thị</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Mô tả</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-500 uppercase tracking-wide w-20">Thứ tự</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-500 uppercase tracking-wide w-28">Trạng thái</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {actionsLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-content-muted text-sm">Đang tải...</td></tr>
                  ) : filteredActions.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-content-muted text-sm">Chưa có hành động nào.</td></tr>
                  ) : filteredActions.map(a => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-dark-50 transition-colors">
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono bg-dark-100 text-dark-600 px-2 py-0.5 rounded border border-dark-200">{a.code}</code>
                      </td>
                      <td className="px-4 py-3 font-medium text-content-primary">{a.name}</td>
                      <td className="px-4 py-3 text-content-secondary text-xs">{a.description ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-content-muted">{a.sortOrder}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge active={a.isActive ?? true} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditAction(a)} className="p-1.5 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Sửa"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteAction(a)} className="p-1.5 text-content-muted hover:text-danger-600 hover:bg-danger-50/10 rounded-lg transition-colors" title="Xóa"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: Nhóm phân hệ ──────────────────────────────────────── */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  value={groupsSearch}
                  onChange={e => setGroupsSearch(e.target.value)}
                  placeholder="Tìm theo mã / tên..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
                />
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowCreateGroup(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={14} /> Thêm nhóm
              </button>
            </div>

            <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-50 border-b border-default">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-40">Mã</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Tên nhóm</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Mô tả</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-500 uppercase tracking-wide w-20">Thứ tự</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-500 uppercase tracking-wide w-24">Phân hệ</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-500 uppercase tracking-wide w-28">Trạng thái</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {groupsLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-content-muted text-sm">Đang tải...</td></tr>
                  ) : filteredGroups.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-content-muted text-sm">Chưa có nhóm phân hệ nào.</td></tr>
                  ) : filteredGroups.map(g => (
                    <tr key={g.id} className="border-b last:border-0 hover:bg-dark-50 transition-colors">
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono bg-dark-100 text-dark-600 px-2 py-0.5 rounded border border-dark-200">{g.code}</code>
                      </td>
                      <td className="px-4 py-3 font-medium text-content-primary">{g.name}</td>
                      <td className="px-4 py-3 text-content-secondary text-xs">{g.description ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-content-muted">{g.sortOrder}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">{g.modules.length}</span>
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge active={g.isActive} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditGroup(g)} className="p-1.5 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Sửa"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteGroup(g)} className="p-1.5 text-content-muted hover:text-danger-600 hover:bg-danger-50/10 rounded-lg transition-colors" title="Xóa"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: Phân hệ ───────────────────────────────────────────── */}
        {activeTab === 'modules' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  value={modulesSearch}
                  onChange={e => setModulesSearch(e.target.value)}
                  placeholder="Tìm theo mã / tên..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
                />
              </div>
              <select
                value={modulesGroupFilter}
                onChange={e => setModulesGroupFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
              >
                <option value="">Tất cả nhóm</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <div className="flex-1" />
              <button
                onClick={() => setShowCreateModule(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={14} /> Thêm phân hệ
              </button>
            </div>

            <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-50 border-b border-default">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Nhóm</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-36">Mã</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Tên phân hệ</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-500 uppercase tracking-wide w-16">TT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Hành động cho phép</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-dark-500 uppercase tracking-wide w-28">Trạng thái</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {modulesLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-content-muted text-sm">Đang tải...</td></tr>
                  ) : filteredModules.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-content-muted text-sm">Chưa có phân hệ nào.</td></tr>
                  ) : filteredModules.map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-dark-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-content-secondary">{m.groupName}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono bg-dark-100 text-dark-600 px-2 py-0.5 rounded border border-dark-200">{m.code}</code>
                      </td>
                      <td className="px-4 py-3 font-medium text-content-primary">{m.name}</td>
                      <td className="px-4 py-3 text-center text-content-muted text-xs">{m.sortOrder}</td>
                      <td className="px-4 py-3">
                        {m.allowedActions.length === 0 ? (
                          <span className="text-xs text-content-muted">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {m.allowedActions.map(a => (
                              <span key={a.id} className="text-xs px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 font-mono font-medium">
                                {a.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge active={m.isActive} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditModule(m)} className="p-1.5 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Sửa"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteModule(m)} className="p-1.5 text-content-muted hover:text-danger-600 hover:bg-danger-50/10 rounded-lg transition-colors" title="Xóa"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}

      {/* Permission Action modals */}
      {(showCreateAction || editAction) && (
        <PermActionModal
          action={editAction ?? undefined}
          onClose={() => { setShowCreateAction(false); setEditAction(null); }}
          onSaved={editAction ? onActionUpdated : onActionCreated}
        />
      )}
      {deleteAction && (
        <DeleteConfirm
          label={deleteAction.name}
          onClose={() => setDeleteAction(null)}
          onConfirm={async () => { await permissionActionsApi.remove(deleteAction.id); onActionDeleted(); }}
        />
      )}

      {/* Module Group modals */}
      {(showCreateGroup || editGroup) && (
        <ModuleGroupModal
          group={editGroup ?? undefined}
          onClose={() => { setShowCreateGroup(false); setEditGroup(null); }}
          onSaved={editGroup ? onGroupUpdated : onGroupCreated}
        />
      )}
      {deleteGroup && (
        <DeleteConfirm
          label={deleteGroup.name}
          onClose={() => setDeleteGroup(null)}
          onConfirm={async () => { await moduleGroupsApi.remove(deleteGroup.id); onGroupDeleted(); }}
        />
      )}

      {/* Module modals */}
      {(showCreateModule || editModule) && (
        <ModuleFormModal
          module={editModule ?? undefined}
          groups={groups}
          allActions={permActions}
          onClose={() => { setShowCreateModule(false); setEditModule(null); }}
          onSaved={editModule ? onModuleUpdated : onModuleCreated}
        />
      )}
      {deleteModule && (
        <DeleteConfirm
          label={deleteModule.name}
          onClose={() => setDeleteModule(null)}
          onConfirm={async () => { await modulesApi.remove(deleteModule.id); onModuleDeleted(); }}
        />
      )}
    </div>
  );
}
