'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Download,
  Plus,
  Pencil,
  Trash2,
  LayoutList,
  Network,
  ChevronRight,
  X,
  Building2,
  Users,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrgNode {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  parentName?: string;
  managerId?: string;
  managerName?: string;
  level: number;
  path: string;
  children?: OrgNode[];
  createdAt: string;
  updatedAt: string;
}

interface UserItem {
  id: string;
  fullName: string;
  email: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function flattenTree(nodes: OrgNode[]): OrgNode[] {
  const result: OrgNode[] = [];
  function visit(n: OrgNode) {
    result.push(n);
    n.children?.forEach(visit);
  }
  nodes.forEach(visit);
  return result;
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('access_token') ?? '';
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

// ─── TreeNode component ───────────────────────────────────────────────────────
function TreeNode({
  node,
  onEdit,
  onDelete,
}: {
  node: OrgNode;
  onEdit: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isTeam = node.level >= 2;

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary-50/60 group transition-colors">
        {/* Chevron / dot */}
        <button
          onClick={() => hasChildren && setOpen((o) => !o)}
          className="w-6 h-6 flex items-center justify-center shrink-0 text-dark-400"
        >
          {hasChildren ? (
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-dark-300 inline-block" />
          )}
        </button>

        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isTeam ? 'bg-success-50' : 'bg-primary-50'
          }`}
        >
          {isTeam ? (
            <Users size={16} className="text-success-600" />
          ) : (
            <Building2 size={16} className="text-primary-500" />
          )}
        </div>

        {/* Name + manager */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-dark-800 leading-tight">{node.name}</p>
          {node.managerName && (
            <p className="text-xs text-primary-500 mt-0.5">{node.managerName}</p>
          )}
        </div>

        {/* Hover actions */}
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={() => onEdit(node)}
            className="p-1.5 text-warning-500 hover:bg-warning-50 rounded-lg transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(node)}
            className="p-1.5 text-danger-400 hover:bg-danger-50 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Code badge */}
        <span className="text-xs font-mono text-dark-500 bg-dark-50 border border-dark-200 px-2 py-0.5 rounded shrink-0">
          {node.code}
        </span>
      </div>

      {open && hasChildren && (
        <div className="ml-7 pl-4 border-l border-dashed border-dark-200">
          {node.children!.map((c) => (
            <TreeNode key={c.id} node={c} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal form ──────────────────────────────────────────────────────────────
function OrgModal({
  editing,
  nodes,
  users,
  onClose,
  onSaved,
}: {
  editing: OrgNode | null;
  nodes: OrgNode[];
  users: UserItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === null;
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [parentId, setParentId] = useState(editing?.parentId ?? '');
  const [managerId, setManagerId] = useState(editing?.managerId ?? '');
  const [clearManager, setClearManager] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isNew) {
        await fetch(`${API}/api/organizations`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            code: code.trim(),
            name: name.trim(),
            parentId: parentId || undefined,
            managerId: managerId || undefined,
          }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).message ?? 'Lỗi tạo phòng ban');
        });
      } else {
        await fetch(`${API}/api/organizations/${editing!.id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({
            name: name.trim() || undefined,
            managerId: managerId || undefined,
            clearManager: clearManager || undefined,
          }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).message ?? 'Lỗi cập nhật phòng ban');
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">
            {isNew ? '+ Thêm phòng ban' : 'Chỉnh sửa phòng ban'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mã phòng ban <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: PB001"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên phòng ban <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Phòng Kế toán - Tài chính"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phòng ban trực thuộc
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Cấp cao nhất —</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {'  '.repeat(n.level)}{n.code} – {n.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Người phụ trách
            </label>
            <select
              value={managerId}
              onChange={(e) => { setManagerId(e.target.value); setClearManager(e.target.value === '__clear__'); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Chưa chọn —</option>
              {!isNew && editing?.managerId && (
                <option value="__clear__">✕ Xóa người phụ trách</option>
              )}
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Đang lưu...' : isNew ? 'Tạo mới' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────
function DeleteDialog({
  node,
  onClose,
  onDeleted,
}: {
  node: OrgNode;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/organizations/${node.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message ?? 'Không thể xóa phòng ban');
      }
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
        <h2 className="font-semibold text-gray-800 mb-2">Xác nhận xóa</h2>
        <p className="text-sm text-gray-600 mb-4">
          Bạn có chắc muốn xóa phòng ban{' '}
          <strong>{node.name}</strong>? Hành động này không thể hoàn tác.
        </p>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
            Hủy
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-60"
          >
            {loading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ToChucPage() {
  const [view, setView] = useState<'table' | 'tree'>('table');
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<OrgNode | null | undefined>(undefined);
  const [deletingNode, setDeletingNode] = useState<OrgNode | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const flat = useMemo(() => flattenTree(tree), [tree]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.toLowerCase();
    return flat.filter(
      (n) =>
        n.code.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q) ||
        n.managerName?.toLowerCase().includes(q) ||
        n.parentName?.toLowerCase().includes(q),
    );
  }, [flat, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function loadTree() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/organizations/tree`, { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        setTree(data.nodes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const first = await fetch(`${API}/api/users?page=1&pageSize=100`, { headers: authHeaders() });
      if (!first.ok) return;
      const firstData = await first.json();
      const totalPages: number = firstData.page?.totalPages ?? 1;
      let items = firstData.items ?? firstData.data ?? [];

      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            fetch(`${API}/api/users?page=${i + 2}&pageSize=100`, { headers: authHeaders() })
              .then(r => r.ok ? r.json() : { items: [] })
              .then(d => d.items ?? d.data ?? [])
          )
        );
        rest.forEach(page => { items = [...items, ...page]; });
      }

      setUsers(items.map((u: { id: string; fullName: string; email: string }) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
      })));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadTree();
    loadUsers();
  }, []);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  function exportExcel() {
    const rows = [['STT', 'Mã phòng ban', 'Tên phòng ban', 'Người phụ trách', 'Phòng ban trực thuộc']];
    filtered.forEach((n, i) => {
      rows.push([String(i + 1), n.code, n.name, n.managerName ?? '', n.parentName ?? '— Cấp cao nhất —']);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'co-cau-to-chuc.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const avatarColors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
    'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
  ];
  function avatarColor(name: string) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return avatarColors[h % avatarColors.length];
  }
  function initials(name: string) {
    return name.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b bg-white">
        <span className="text-sm text-gray-400">Cấu hình hệ thống</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-sm font-medium text-gray-700">Cơ cấu tổ chức</span>
      </div>

      {/* Title */}
      <div className="px-6 pt-5 pb-1 bg-white">
        <h1 className="text-xl font-semibold text-gray-800">Cơ cấu tổ chức</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b">
        {/* View toggle */}
        <div className="flex border rounded-lg overflow-hidden">
          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
              view === 'table' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutList size={14} />
            Bảng
          </button>
          <button
            onClick={() => setView('tree')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-l ${
              view === 'tree' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Network size={14} />
            Sơ đồ cây
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm phòng ban..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1" />

        {/* Export */}
        <button
          onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 text-gray-600"
        >
          <Download size={14} />
          Xuất Excel
        </button>

        {/* Add */}
        <button
          onClick={() => setEditingNode(null)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} />
          Thêm phòng ban
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Đang tải...
          </div>
        ) : view === 'tree' ? (
          /* ── Tree view ── */
          <div className="bg-white rounded-xl border shadow-sm p-4">
            {tree.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Chưa có phòng ban nào.</p>
            ) : (
              tree.map((n) => (
                <TreeNode
                  key={n.id}
                  node={n}
                  onEdit={(node) => setEditingNode(node)}
                  onDelete={(node) => setDeletingNode(node)}
                />
              ))
            )}
          </div>
        ) : (
          /* ── Table view ── */
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50 border-b">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="rounded" />
                  </th>
                  <th className="w-12 px-2 py-3 text-left text-amber-700 font-semibold">STT</th>
                  <th className="px-4 py-3 text-left text-amber-700 font-semibold">Mã phòng ban</th>
                  <th className="px-4 py-3 text-left text-amber-700 font-semibold">Tên phòng ban</th>
                  <th className="px-4 py-3 text-left text-amber-700 font-semibold">Người phụ trách</th>
                  <th className="px-4 py-3 text-left text-amber-700 font-semibold">Phòng ban trực thuộc</th>
                  <th className="px-4 py-3 text-right text-amber-700 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      {search ? 'Không tìm thấy phòng ban phù hợp.' : 'Chưa có phòng ban nào.'}
                    </td>
                  </tr>
                ) : (
                  paginated.map((node, idx) => (
                    <tr key={node.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded" />
                      </td>
                      <td className="px-2 py-3 text-gray-500">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 font-mono text-xs px-2 py-0.5 rounded">
                          # {node.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{node.name}</td>
                      <td className="px-4 py-3">
                        {node.managerName ? (
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full ${avatarColor(node.managerName)} flex items-center justify-center text-white text-xs font-semibold`}
                            >
                              {initials(node.managerName)}
                            </div>
                            <span className="text-gray-700">{node.managerName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {node.parentName ? (
                          <span className="text-blue-600">{node.parentName}</span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">— Cấp cao nhất —</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingNode(node)}
                            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingNode(node)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded"
                            title="Xóa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
                <span>
                  Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length} phòng ban
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    &lsaquo;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | '...')[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-1">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`px-2.5 py-1 border rounded ${
                            page === p ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    &rsaquo;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {editingNode !== undefined && (
        <OrgModal
          editing={editingNode}
          nodes={flat}
          users={users}
          onClose={() => setEditingNode(undefined)}
          onSaved={loadTree}
        />
      )}

      {/* Delete confirm */}
      {deletingNode && (
        <DeleteDialog
          node={deletingNode}
          onClose={() => setDeletingNode(null)}
          onDeleted={loadTree}
        />
      )}
    </div>
  );
}
