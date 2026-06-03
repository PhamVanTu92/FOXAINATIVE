'use client';

import React, { useState } from 'react';
import {
  Search, Download, Plus, Pencil,
  ChevronRight, X, Users, UserCheck, UserX,
  Shield, Key, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import { UserPermissionsModal } from './UserPermissionsModal';
import { usersApi } from '@/lib/users-api';
import type { UserItem, RoleItem, OrgNode } from '@/lib/users-api';
import { SelectDropdown } from '@/components/SelectDropdown';
import { useRoutePermission } from '@/hooks/usePermission';

// ─── Shared constants ─────────────────────────────────────────────────────────
const inputCls = 'w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-transparent bg-surface transition-colors [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_var(--bg-surface)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--text-primary)]';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-500',
  'bg-rose-500', 'bg-teal-600', 'bg-sky-600', 'bg-orange-600',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
}

const ROLE_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',   'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',   'bg-sky-100 text-sky-700',
];
function roleColor(role: string) {
  let h = 0;
  for (let i = 0; i < role.length; i++) h = (h * 31 + role.charCodeAt(i)) & 0xffff;
  return ROLE_COLORS[h % ROLE_COLORS.length];
}

// ─── Micro-components ─────────────────────────────────────────────────────────
function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-content-muted mt-1">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm">
      <AlertCircle size={14} className="shrink-0" />
      {message}
    </div>
  );
}


function StatusToggle({ status, onToggle }: { status: string; onToggle: () => void }) {
  const active = status === 'ACTIVE';
  return (
    <button onClick={onToggle} className="flex items-center gap-2"
      title={active ? 'Nhấn để vô hiệu hóa' : 'Nhấn để kích hoạt'}
    >
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-primary-500' : 'bg-subtle'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${active ? 'text-primary-600' : 'text-content-muted'}`}>
        {active ? 'Hoạt động' : 'Vô hiệu'}
      </span>
    </button>
  );
}

// ─── UserModal ────────────────────────────────────────────────────────────────
function UserModal({ editing, roles, orgs, onClose, onSaved }: {
  editing: UserItem | null;
  roles: RoleItem[];
  orgs: OrgNode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === null;
  const [username, setUsername] = useState(editing?.username ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [organizationId, setOrganizationId] = useState(editing?.organizationId ?? '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleRole(code: string) {
    setSelectedRoles(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isNew) {
        await usersApi.create({
          username: username.trim(),
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          organizationId: organizationId || undefined,
          roleCodes: selectedRoles.length > 0 ? selectedRoles : undefined,
        });
      } else {
        await usersApi.update(editing!.id, {
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          organizationId: organizationId || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default sticky top-0 bg-surface z-10">
          <h2 className="font-semibold text-content-primary">
            {isNew ? '+ Thêm người dùng mới' : 'Chỉnh sửa người dùng'}
          </h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {isNew && (
            <>
              <Field label="Tên đăng nhập" required hint="Chỉ chữ thường, số, dấu . / _ / -">
                <input required value={username} onChange={e => setUsername(e.target.value.toLowerCase())}
                  placeholder="VD: nguyen.van.an" className={inputCls} />
              </Field>
              <Field label="Email" required>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="VD: an.nguyen@foxai.vn" className={inputCls} />
              </Field>
              <Field label="Mật khẩu" required>
                <input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Ít nhất 8 ký tự" className={inputCls} />
              </Field>
            </>
          )}
          <Field label="Họ và tên" required>
            <input required value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="VD: Nguyễn Văn An" className={inputCls} />
          </Field>
          <Field label="Số điện thoại">
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="VD: 0901234567" className={inputCls} />
          </Field>
          <Field label="Phòng ban">
            <SelectDropdown
              value={organizationId}
              onChange={setOrganizationId}
              placeholder="— Chưa chọn —"
              options={orgs.map(o => ({ value: o.id, label: o.name }))}
              className="w-full"
            />
          </Field>
          {isNew && (
            <Field label="Vai trò">
              <div className="space-y-1 max-h-40 overflow-y-auto border border-default rounded-lg p-2">
                {roles.length === 0 ? (
                  <p className="text-xs text-content-muted text-center py-2">Chưa có vai trò nào</p>
                ) : roles.map(role => (
                  <label key={role.code} className="flex items-center gap-2 cursor-pointer hover:bg-subtle px-2 py-1 rounded">
                    <input type="checkbox" className="rounded"
                      checked={selectedRoles.includes(role.code)}
                      onChange={() => toggleRole(role.code)} />
                    <span className="text-sm text-content-secondary">{role.name}</span>
                    {role.description && (
                      <span className="text-xs text-content-muted ml-auto truncate">{role.description}</span>
                    )}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {error && <ErrorBanner message={error} />}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle">
              Hủy
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-60 transition-all">
              {loading ? 'Đang lưu...' : isNew ? 'Tạo người dùng' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ChangePasswordModal ───────────────────────────────────────────────────────
function ChangePasswordModal({ user, onClose }: { user: UserItem; onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('Mật khẩu xác nhận không khớp'); return; }
    setLoading(true);
    setError('');
    try {
      await usersApi.changePassword(user.id, oldPassword, newPassword);
      setDone(true);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="font-semibold text-content-primary">Đổi mật khẩu — {user.fullName}</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary"><X size={18} /></button>
        </div>
        {done ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserCheck className="w-6 h-6 text-success-600" />
            </div>
            <p className="text-content-secondary font-medium">Đổi mật khẩu thành công!</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <Field label="Mật khẩu hiện tại" required>
              <input required type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Mật khẩu mới" required>
              <input required type="password" minLength={8} value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" className={inputCls} />
            </Field>
            <Field label="Xác nhận mật khẩu" required>
              <input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} />
            </Field>
            {error && <ErrorBanner message={error} />}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle">
                Hủy
              </button>
              <button type="submit" disabled={loading}
                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-60 transition-all">
                {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── DeleteDialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ user, onClose, onDeleted }: {
  user: UserItem; onClose: () => void; onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true);
    try {
      await usersApi.remove(user.id);
      onDeleted();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-semibold text-content-primary mb-2">Xác nhận xóa</h2>
        <p className="text-sm text-content-secondary mb-4">
          Bạn có chắc muốn xóa người dùng <strong>{user.fullName}</strong>{' '}
          (<code className="text-xs font-mono bg-subtle text-content-secondary px-2 py-0.5 rounded border border-default">{user.username}</code>)?{' '}
          Hành động này không thể hoàn tác.
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle">
            Hủy
          </button>
          <button onClick={confirm} disabled={loading}
            className="px-4 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-60">
            {loading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function UserListView() {
  const {
    users, total, totalPages, page, setPage, pageSize,
    search, setSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    loading, error,
    roles, orgMap, flatOrgs, stats,
    showCreate, setShowCreate,
    editingUser, setEditingUser,
    permissionsUser, setPermissionsUser,
    deletingUser, setDeletingUser,
    handleToggleStatus, handleRefresh,
    loadUsers, loadStats,
  } = useUsers();

  const canCreate = useRoutePermission('CREATE');
  const canUpdate = useRoutePermission('UPDATE');
  const canDelete = useRoutePermission('DELETE');
  const canExport = useRoutePermission('EXPORT');

  function exportCsv() {
    const rows = [['STT', 'Họ và tên', 'Tên đăng nhập', 'Email', 'Vai trò', 'Phòng ban', 'Trạng thái']];
    users.forEach((u, i) => rows.push([
      String(i + 1), u.fullName, u.username, u.email,
      u.roles.join(', '),
      orgMap[u.organizationId ?? ''] ?? '',
      u.status === 'ACTIVE' ? 'Hoạt động' : 'Vô hiệu',
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'danh-sach-nguoi-dung.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const STATS = [
    { label: 'Tổng người dùng', value: stats.total,    Icon: Users,     bg: 'bg-primary-100', color: 'text-primary-600',  accent: 'border-l-primary-500'  },
    { label: 'Đang hoạt động',  value: stats.active,   Icon: UserCheck, bg: 'bg-success-100', color: 'text-success-600',  accent: 'border-l-success-500'  },
    { label: 'Vô hiệu hóa',     value: stats.inactive, Icon: UserX,     bg: 'bg-danger-100',  color: 'text-danger-600',   accent: 'border-l-danger-500'   },
    { label: 'Quản trị viên',   value: stats.admins,   Icon: Shield,    bg: 'bg-warning-100', color: 'text-warning-600',  accent: 'border-l-warning-500'  },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-default shadow-sm px-6 py-4">
        <div className="flex items-center gap-1.5 text-xs text-content-muted mb-2">
          <span>Cấu hình hệ thống</span>
          <ChevronRight size={12} className="text-content-muted opacity-50" />
          <span className="text-content-secondary font-medium">Cấu hình người dùng</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold text-content-primary">Cấu hình người dùng</h1>
              <p className="text-xs text-content-muted mt-0.5">Quản lý tài khoản và phân quyền truy cập hệ thống</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {STATS.map(({ label, value, Icon, bg, color, accent }) => (
            <div key={label} className={`bg-surface rounded-xl border-l-4 border border-strong shadow-sm px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow duration-base ${accent}`}>
              <div>
                <p className="text-xs text-content-secondary">{label}</p>
                <p className="text-2xl font-bold text-content-primary mt-1">{value}</p>
              </div>
              <div className={`p-3 rounded-xl ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm người dùng..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-transparent transition-all bg-surface text-content-primary"
            />
          </div>
          <SelectDropdown
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder="Tất cả vai trò"
            options={roles.map(r => ({ value: r.code, label: r.name }))}
          />
          <SelectDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Tất cả trạng thái"
            options={[
              { value: 'ACTIVE', label: 'Hoạt động' },
              { value: 'INACTIVE', label: 'Vô hiệu' },
              { value: 'LOCKED', label: 'Bị khóa' },
            ]}
          />
          <div className="flex-1" />
          <button onClick={handleRefresh}
            className="p-2 rounded-lg text-content-muted hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Làm mới">
            <RefreshCw size={16} />
          </button>
          {canExport && (
            <button onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
              <Download size={14} /> Xuất Excel
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 transition-all">
              <Plus size={14} /> Thêm người dùng
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-100 border-b border-primary-200 text-primary-600 text-left font-semibold">
                <th className="px-4 py-3 w-12 text-center">STT</th>
                <th className="px-4 py-3">NGƯỜI DÙNG</th>
                <th className="px-4 py-3">TÊN ĐĂNG NHẬP</th>
                <th className="px-4 py-3">VAI TRÒ</th>
                <th className="px-4 py-3">PHÒNG BAN</th>
                <th className="px-4 py-3">TRẠNG THÁI</th>
                <th className="px-4 py-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-strong">
              {users.map((user, idx) => (
                <tr key={user.id} className="hover:bg-subtle transition-colors">
                  <td className="px-4 py-3 text-content-secondary text-center">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(user.fullName)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                        {initials(user.fullName)}
                      </div>
                      <div>
                        <p className="font-medium text-content-primary">{user.fullName}</p>
                        <p className="text-xs text-content-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono bg-subtle text-content-secondary px-2 py-0.5 rounded border border-default">
                      {user.username}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0
                        ? <span className="text-content-muted text-xs">—</span>
                        : user.roles.map(r => {
                          const label = roles.find(role => role.code === r)?.name ?? r;
                          return (
                            <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>{label}</span>
                          );
                        })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-content-secondary text-sm">
                    {user.organizationId && orgMap[user.organizationId]
                      ? orgMap[user.organizationId]
                      : <span className="text-content-muted text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusToggle status={user.status} onToggle={() => handleToggleStatus(user)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && (
                        <button onClick={() => setEditingUser(user)}
                          className="p-1.5 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Chỉnh sửa">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canUpdate && (
                        <button onClick={() => setPermissionsUser(user)}
                          className="p-1.5 text-content-muted hover:text-warning-600 hover:bg-warning-50/10 rounded-lg transition-colors" title="Phân quyền">
                          <Key size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-default text-sm text-content-secondary">
              <span>Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total} người dùng</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 border border-default rounded hover:bg-subtle disabled:opacity-40 transition-colors">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '...'
                    ? <span key={`e${i}`} className="px-2 py-1 text-content-muted">…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className={`px-2.5 py-1 border rounded transition-colors ${page === p ? 'bg-primary-600 text-white border-primary-600 font-medium' : 'border-default hover:bg-subtle'}`}>
                        {p}
                      </button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 border border-default rounded hover:bg-subtle disabled:opacity-40 transition-colors">›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <UserModal editing={null} roles={roles} orgs={flatOrgs}
          onClose={() => setShowCreate(false)}
          onSaved={() => { loadUsers(); loadStats(); }}
        />
      )}
      {editingUser && (
        <UserModal editing={editingUser} roles={roles} orgs={flatOrgs}
          onClose={() => setEditingUser(null)}
          onSaved={() => { loadUsers(); loadStats(); }}
        />
      )}
      {permissionsUser && (
        <UserPermissionsModal user={permissionsUser} onClose={() => setPermissionsUser(null)} />
      )}
    </div>
  );
}
