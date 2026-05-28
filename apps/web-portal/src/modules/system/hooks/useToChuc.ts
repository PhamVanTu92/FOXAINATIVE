'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface OrgNode {
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

export interface OrgUserItem {
  id: string;
  fullName: string;
  email: string;
}

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

export function useToChuc() {
  const [view, setView] = useState<'table' | 'tree'>('table');
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [users, setUsers] = useState<OrgUserItem[]>([]);
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

  const loadTree = useCallback(async () => {
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
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const first = await fetch(`${API}/api/users?page=1&pageSize=100`, { headers: authHeaders() });
      if (!first.ok) return;
      const firstData = await first.json();
      const pages: number = firstData.page?.totalPages ?? 1;
      let items = firstData.items ?? firstData.data ?? [];

      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            fetch(`${API}/api/users?page=${i + 2}&pageSize=100`, { headers: authHeaders() })
              .then(r => r.ok ? r.json() : { items: [] })
              .then(d => d.items ?? d.data ?? [])
          )
        );
        rest.forEach(p => { items = [...items, ...p]; });
      }

      setUsers(items.map((u: { id: string; fullName: string; email: string }) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
      })));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTree();
    loadUsers();
  }, [loadTree, loadUsers]);

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

  return {
    // view toggle
    view, setView,
    // data
    tree, flat, filtered, paginated,
    users,
    // search + pagination
    search, setSearch,
    page, setPage, pageSize, totalPages,
    // loading
    loading,
    // modals
    editingNode, setEditingNode,
    deletingNode, setDeletingNode,
    // actions
    loadTree,
    exportExcel,
  };
}
