'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { knowledgeBasesApi } from '@/lib/knowledge-api';
import type { KnowledgeBase, KbGlobalStats, CreateKbPayload } from '@/lib/knowledge-api';

export function useKnowledgeList() {
  const [allItems, setAllItems] = useState<KnowledgeBase[]>([]);
  const [stats, setStats] = useState<KbGlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listRes, statsRes] = await Promise.all([
        knowledgeBasesApi.list({ pageSize: 100 }),
        knowledgeBasesApi.stats(),
      ]);
      setAllItems(listRes.items);
      setStats(statsRes);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    let list = allItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(kb =>
        kb.name.toLowerCase().includes(q) ||
        kb.code.toLowerCase().includes(q) ||
        kb.managingDepartmentName.toLowerCase().includes(q)
      );
    }
    if (departmentFilter) {
      list = list.filter(kb => kb.managingDepartmentName === departmentFilter);
    }
    return list;
  }, [allItems, search, departmentFilter]);

  const departments = useMemo(() =>
    [...new Set(allItems.map(kb => kb.managingDepartmentName))].sort(),
    [allItems]
  );

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function createKb(payload: CreateKbPayload) {
    setCreating(true);
    setError('');
    try {
      const created = await knowledgeBasesApi.create(payload);
      setAllItems(prev => [created, ...prev]);
      setShowCreate(false);
      showSuccess('Đã tạo bộ tri thức thành công');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function exportExcel() {
    const rows = [['Mã', 'Tên bộ tri thức', 'Phòng ban quản lý', 'Tổng tệp', 'Ngày cập nhật']];
    items.forEach(kb => rows.push([
      kb.code, kb.name, kb.managingDepartmentName,
      String(kb.totalFiles ?? 0), kb.updatedAt?.slice(0, 10) ?? '',
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tri-thuc.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return {
    items, stats, loading, error, successMsg,
    search, setSearch,
    departmentFilter, setDepartmentFilter,
    departments,
    showCreate, setShowCreate,
    creating, createKb,
    exportExcel,
  };
}
