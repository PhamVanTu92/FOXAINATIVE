'use client';

import React, { useState } from 'react';
import {
  Search, Download, Plus, Pencil, Trash2,
  ChevronRight, X, Users, UserCheck, UserX,
  Shield, Key, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import { UserPermissionsModal } from './UserPermissionsModal';
import { usersApi } from '@/lib/users-api';
import type { UserItem, RoleItem, OrgNode } from '@/lib/users-api';

// ─── Shared constants ─────────────────────────────────────────────────────────
const inputCls = 'w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-primary-500', 'bg-violet-600', 'bg-success-600', 'bg-warning-500',
  'bg-danger-500', 'bg-teal-600', 'bg-sky-600', 'bg-orange-600',
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
  'bg-primary-100 text-primary-700', 'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700', 'bg-violet-100 text-violet-700',
  'bg-danger-100 text-danger-700',   'bg-teal-100 text-teal-700',
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
      <label className="block text-sm font-medium text-dark-700 mb-1">
        {label} {required && <span className="text-danger-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-dark-400 mt-1">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-3 py-2 text-sm">
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
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-primary-500' : 'bg-dark-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${active ? 'text-primary-600' : 'text-dark-400'}`}>
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-dark-800">
            {isNew ? '+ Thêm người dùng mới' : 'Chỉnh sửa người dùng'}
          </h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600"><X size={18} /></button>
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
            <select value={organizationId} onChange={e => setOrganizationId(e.target.value)}
              className={inputCls}>
              <option value="">— Chưa chọn —</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          {isNew && (
            <Field label="Vai trò">
              <div className="space-y-1 max-h-40 overflow-y-auto border border-dark-200 rounded-lg p-2">
                {roles.length === 0 ? (
                  <p className="text-xs text-dark-400 text-center py-2">Chưa có vai trò nào</p>
                ) : roles.map(role => (
                  <label key={role.code} className="flex items-center gap-2 cursor-pointer hover:bg-dark-50 px-2 py-1 rounded">
                    <input type="checkbox" className="rounded"
                      checked={selectedRoles.includes(role.code)}
                      onChange={() => toggleRole(role.code)} />
                    <span className="text-sm text-dark-700">{role.name}</span>
                    {role.description && (
                      <span className="text-xs text-dark-400 ml-auto truncate">{role.description}</span>
                    )}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {error && <ErrorBanner message={error} />}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50">
              Hủy
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-gradient-primary text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-60 transition-all">
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
          <h2 className="font-semibold text-dark-800">Đổi mật khẩu — {user.fullName}</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600"><X size={18} /></button>
        </div>
        {done ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserCheck className="w-6 h-6 text-success-600" />
            </div>
            <p className="text-dark-700 font-medium">Đổi mật khẩu thành công!</p>
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
                className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50">
                Hủy
              </button>
              <button type="submit" disabled={loading}
                className="px-4 py-2 text-sm bg-gradient-primary text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-60 transition-all">
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-semibold text-dark-800 mb-2">Xác nhận xóa</h2>
        <p className="text-sm text-dark-600 mb-4">
          Bạn có chắc muốn xóa người dùng <strong>{user.fullName}</strong>{' '}
          (<code className="text-xs font-mono bg-dark-100 text-dark-600 px-2 py-0.5 rounded border border-dark-200">{user.username}</code>)?{' '}
          Hành động này không thể hoàn tác.
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50">
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
    { label: 'Vô hiệu hóa',     value: stats.inactive, Icon: UserX,     bg: 'bg-danger-100',  color: 'text-danger-500',   accent: 'border-l-danger-400'   },
    { label: 'Quản trị viên',   value: stats.admins,   Icon: Shield,    bg: 'bg-warning-100', color: 'text-warning-600',  accent: 'border-l-warning-500'  },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-dark-200 shadow-sm px-6 py-4">
        <div className="flex items-center gap-1.5 text-xs text-dark-400 mb-2">
          <span>Cấu hình hệ thống</span>
          <ChevronRight size={12} className="text-dark-300" />
          <span className="text-dark-600 font-medium">Cấu hình người dùng</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-gradient-primary shrink-0" />
            <div>
              <h1 className="text-lg font-semibold text-dark-900">Cấu hình người dùng</h1>
              <p className="text-xs text-dark-400 mt-0.5">Quản lý tài khoản và phân quyền truy cập hệ thống</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {STATS.map(({ label, value, Icon, bg, color, accent }) => (
            <div key={label} className={`bg-white rounded-xl border-l-4 border border-dark-100 shadow-sm px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow ${accent}`}>
              <div>
                <p className="text-xs text-dark-500">{label}</p>
                <p className="text-2xl font-bold text-dark-900 mt-1">{value}</p>
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm người dùng..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700">
            <option value="">Tất cả vai trò</option>
            {roles.map(r => <option key={r.code} value={r.name}>{r.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700">
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Vô hiệu</option>
            <option value="LOCKED">Bị khóa</option>
          </select>
          <div className="flex-1" />
          <button onClick={handleRefresh}
            className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Làm mới">
            <RefreshCw size={16} />
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
            <Download size={14} /> Xuất Excel
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-primary text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 transition-all">
            <Plus size={14} /> Thêm người dùng
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-dark-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dark-50 border-b border-dark-200">
                <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" /></th>
                <th className="w-12 px-2 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">STT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Người dùng</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Tên đăng nhập</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Vai trò</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Phòng ban</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-36">Trạng thái</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-dark-500 uppercase tracking-wide w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-dark-400 text-sm">Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14">
                    <Users className="w-10 h-10 text-dark-200 mx-auto mb-2" />
                    <p className="text-dark-400 text-sm">
                      {search || roleFilter || statusFilter
                        ? 'Không tìm thấy người dùng phù hợp.'
                        : 'Chưa có người dùng nào. Nhấn "Thêm người dùng" để bắt đầu.'}
                    </p>
                  </td>
                </tr>
              ) : users.map((user, idx) => (
                <tr key={user.id} className="border-b border-dark-100 last:border-0 hover:bg-dark-50 transition-colors">
                  <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                  <td className="px-2 py-3 text-dark-400 text-xs">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(user.fullName)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                        {initials(user.fullName)}
                      </div>
                      <div>
                        <p className="font-medium text-dark-900">{user.fullName}</p>
                        <p className="text-xs text-dark-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono bg-dark-100 text-dark-600 px-2 py-0.5 rounded border border-dark-200">
                      {user.username}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0
                        ? <span className="text-dark-300 text-xs">—</span>
                        : user.roles.map(r => (
                          <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>{r}</span>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-dark-700 text-sm">
                    {user.organizationId && orgMap[user.organizationId]
                      ? orgMap[user.organizationId]
                      : <span className="text-dark-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusToggle status={user.status} onToggle={() => handleToggleStatus(user)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditingUser(user)}
                        className="p-1.5 text-dark-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Chỉnh sửa">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setPermissionsUser(user)}
                        className="p-1.5 text-dark-400 hover:text-warning-600 hover:bg-warning-50 rounded-lg transition-colors" title="Phân quyền">
                        <Key size={14} />
                      </button>
                      <button onClick={() => setDeletingUser(user)}
                        className="p-1.5 text-dark-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors" title="Xóa">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-dark-100 text-sm text-dark-500">
              <span>Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total} người dùng</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 border border-dark-200 rounded hover:bg-dark-50 disabled:opacity-40">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '...'
                    ? <span key={`e${i}`} className="px-2 py-1 text-dark-400">…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className={`px-2.5 py-1 border rounded ${page === p ? 'bg-primary-600 text-white border-primary-600' : 'border-dark-200 hover:bg-dark-50'}`}>
                        {p}
                      </button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 border border-dark-200 rounded hover:bg-dark-50 disabled:opacity-40">›</button>
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
      {deletingUser && (
        <DeleteDialog user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={() => { loadUsers(); loadStats(); }}
        />
      )}
    </div>
  );
}
