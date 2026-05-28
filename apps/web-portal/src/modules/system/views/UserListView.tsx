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
const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent bg-white transition-all';

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
      <label className="block text-sm font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
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
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-blue-500' : 'bg-slate-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-slate-400'}`}>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-900">
            {isNew ? '+ Thêm người dùng mới' : 'Chỉnh sửa người dùng'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
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
              <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {roles.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">Chưa có vai trò nào</p>
                ) : roles.map(role => (
                  <label key={role.code} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded">
                    <input type="checkbox" className="rounded"
                      checked={selectedRoles.includes(role.code)}
                      onChange={() => toggleRole(role.code)} />
                    <span className="text-sm text-slate-600">{role.name}</span>
                    {role.description && (
                      <span className="text-xs text-slate-400 ml-auto truncate">{role.description}</span>
                    )}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {error && <ErrorBanner message={error} />}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-100">
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Đổi mật khẩu — {user.fullName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {done ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-slate-600 font-medium">Đổi mật khẩu thành công!</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                className="px-4 py-2 text-sm border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-100">
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Xác nhận xóa</h2>
        <p className="text-sm text-slate-600 mb-4">
          Bạn có chắc muốn xóa người dùng <strong>{user.fullName}</strong>{' '}
          (<code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{user.username}</code>)?{' '}
          Hành động này không thể hoàn tác.
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-100">
            Hủy
          </button>
          <button onClick={confirm} disabled={loading}
            className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-60">
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
    { label: 'Tổng người dùng', value: stats.total,    Icon: Users,     bg: 'bg-blue-100', color: 'text-blue-600',  accent: 'border-l-blue-500'  },
    { label: 'Đang hoạt động',  value: stats.active,   Icon: UserCheck, bg: 'bg-emerald-100', color: 'text-emerald-600',  accent: 'border-l-emerald-500'  },
    { label: 'Vô hiệu hóa',     value: stats.inactive, Icon: UserX,     bg: 'bg-rose-100',  color: 'text-rose-600',   accent: 'border-l-rose-500'   },
    { label: 'Quản trị viên',   value: stats.admins,   Icon: Shield,    bg: 'bg-amber-100', color: 'text-amber-600',  accent: 'border-l-amber-500'  },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-6 py-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <span>Cấu hình hệ thống</span>
          <ChevronRight size={12} className="text-slate-300" />
          <span className="text-slate-500 font-medium">Cấu hình người dùng</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Cấu hình người dùng</h1>
              <p className="text-xs text-slate-400 mt-0.5">Quản lý tài khoản và phân quyền truy cập hệ thống</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {STATS.map(({ label, value, Icon, bg, color, accent }) => (
            <div key={label} className={`bg-white rounded-xl border-l-4 border border-slate-100 shadow-sm px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow duration-base ${accent}`}>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm người dùng..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent transition-all"
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white text-slate-500 transition-all">
            <option value="">Tất cả vai trò</option>
            {roles.map(r => <option key={r.code} value={r.name}>{r.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white text-slate-500 transition-all">
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Vô hiệu</option>
            <option value="LOCKED">Bị khóa</option>
          </select>
          <div className="flex-1" />
          <button onClick={handleRefresh}
            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Làm mới">
            <RefreshCw size={16} />
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">
            <Download size={14} /> Xuất Excel
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 transition-all">
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
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-left font-semibold">
                <th className="px-4 py-3 w-12 text-center">STT</th>
                <th className="px-4 py-3">NGƯỜI DÙNG</th>
                <th className="px-4 py-3">TÊN ĐĂNG NHẬP</th>
                <th className="px-4 py-3">VAI TRÒ</th>
                <th className="px-4 py-3">PHÒNG BAN</th>
                <th className="px-4 py-3">TRẠNG THÁI</th>
                <th className="px-4 py-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user, idx) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-center">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(user.fullName)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                        {initials(user.fullName)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.fullName}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                      {user.username}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0
                        ? <span className="text-slate-400 text-xs">—</span>
                        : user.roles.map(r => (
                          <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(r)}`}>{r}</span>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {user.organizationId && orgMap[user.organizationId]
                      ? orgMap[user.organizationId]
                      : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusToggle status={user.status} onToggle={() => handleToggleStatus(user)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditingUser(user)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chỉnh sửa">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setPermissionsUser(user)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Phân quyền">
                        <Key size={14} />
                      </button>
                      <button onClick={() => setDeletingUser(user)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Xóa">
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm text-slate-500">
              <span>Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total} người dùng</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 transition-colors">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '...'
                    ? <span key={`e${i}`} className="px-2 py-1 text-slate-400">…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className={`px-2.5 py-1 border rounded transition-colors ${page === p ? 'bg-blue-600 text-white border-blue-600 font-medium' : 'border-slate-200 hover:bg-slate-100'}`}>
                        {p}
                      </button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 transition-colors">›</button>
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
