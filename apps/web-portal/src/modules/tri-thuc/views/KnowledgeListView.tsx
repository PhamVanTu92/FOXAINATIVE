'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, FileText, Users, Calendar, Search, Download,
  Plus, X, Check, Loader2, AlertCircle, ChevronRight,
} from 'lucide-react';
import { useKnowledgeList } from '../hooks/useKnowledgeList';
import type { KnowledgeBase, KbFileCounts, CreateKbPayload } from '@/lib/knowledge-api';

// ─── File type badges ─────────────────────────────────────────────────────────

const FILE_TYPE_CFG: Record<string, { label: string; color: string }> = {
  word:  { label: 'Word',  color: 'bg-primary-100 text-primary-700' },
  excel: { label: 'Excel', color: 'bg-success-100 text-success-700' },
  pdf:   { label: 'PDF',   color: 'bg-danger-100 text-danger-700' },
  image: { label: 'Ảnh',   color: 'bg-violet-100 text-violet-700' },
};

function FileTypeBadges({ fileCounts }: { fileCounts?: KbFileCounts }) {
  if (!fileCounts) return null;
  const entries = Object.entries(fileCounts).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, count]) => {
        const cfg = FILE_TYPE_CFG[key];
        if (!cfg) return null;
        return (
          <span key={key} className={`text-xs font-medium px-2 py-0.5 rounded-md ${cfg.color}`}>
            {cfg.label} ×{count}
          </span>
        );
      })}
    </div>
  );
}

// ─── Create KB Modal ──────────────────────────────────────────────────────────

function CreateKBModal({
  onClose, onSave, saving, error,
}: {
  onClose: () => void;
  onSave: (p: CreateKbPayload) => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState({
    code: '', name: '', description: '', managingDepartmentName: '',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      code: form.code.toUpperCase(),
      name: form.name,
      description: form.description || undefined,
      managingDepartmentId: crypto.randomUUID(),
      managingDepartmentName: form.managingDepartmentName,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
          <h2 className="font-semibold text-dark-800">Tạo bộ tri thức mới</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Mã bộ tri thức <span className="text-danger-600">*</span>
              <span className="text-dark-400 font-normal ml-1">(chữ hoa, số, gạch ngang)</span>
            </label>
            <input value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="VD: KB006" required
              className="w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Tên bộ tri thức <span className="text-danger-600">*</span>
            </label>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Tri Thức Kế toán – Tài chính" required
              className="w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Mô tả</label>
            <textarea value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả nội dung bộ tri thức..." rows={3}
              className="w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Phòng ban quản lý <span className="text-danger-600">*</span>
            </label>
            <input value={form.managingDepartmentName}
              onChange={e => setForm(f => ({ ...f, managingDepartmentName: e.target.value }))}
              placeholder="VD: Phòng Kế toán - Tài chính" required
              className="w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Tạo bộ tri thức
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KB Card ──────────────────────────────────────────────────────────────────

function KBCard({ kb, onClick }: { kb: KnowledgeBase; onClick: () => void }) {
  const totalFiles = kb.totalFiles ?? (kb.fileCounts
    ? (kb.fileCounts.word + kb.fileCounts.excel + kb.fileCounts.pdf + kb.fileCounts.image)
    : 0);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-dark-200 p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-teal-50 shrink-0">
          <BookOpen size={20} className="text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-dark-800 leading-snug line-clamp-2">{kb.name}</h3>
          {kb.description && (
            <p className="text-xs text-dark-500 mt-1 line-clamp-2">{kb.description}</p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-dark-400 border-t border-dark-100 pt-2.5">
        <span className="font-mono font-medium text-dark-500">#{kb.code}</span>
        <span className="flex items-center gap-1">
          <FileText size={11} /> {totalFiles} tệp
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={11} /> {kb.updatedAt?.slice(0, 10)}
        </span>
      </div>

      {/* Permissions */}
      {kb.permissions?.length > 0 && (
        <div>
          <p className="text-xs text-dark-400 mb-1.5">Phân quyền:</p>
          <div className="flex flex-wrap gap-1">
            {kb.permissions.slice(0, 3).map(d => (
              <span key={d.departmentId}
                className="text-xs px-2 py-0.5 bg-dark-100 text-dark-600 rounded-md truncate max-w-[150px]">
                {d.departmentName}
              </span>
            ))}
            {kb.permissions.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-dark-100 text-dark-500 rounded-md">
                +{kb.permissions.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* File badges */}
      <FileTypeBadges fileCounts={kb.fileCounts} />
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function KnowledgeListView() {
  const router = useRouter();
  const {
    items, stats, loading, error, successMsg,
    search, setSearch,
    departmentFilter, setDepartmentFilter,
    departments,
    showCreate, setShowCreate,
    creating, createKb,
    exportExcel,
  } = useKnowledgeList();

  return (
    <div className="flex flex-col h-full bg-dark-50">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-dark-200">
        <span className="text-sm text-dark-400">Tri thức AI</span>
        <ChevronRight size={14} className="text-dark-300" />
        <span className="text-sm font-medium text-dark-700">Quản lý tri thức</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Tổng bộ tri thức', value: stats?.totalKnowledgeBases ?? items.length, Icon: BookOpen, color: 'bg-teal-50 text-teal-600' },
              { label: 'Tổng tệp tri thức', value: stats?.totalFiles ?? '—', Icon: FileText, color: 'bg-primary-50 text-primary-600' },
              { label: 'Phòng ban sử dụng', value: stats?.departmentsUsingCount ?? departments.length, Icon: Users, color: 'bg-violet-50 text-violet-600' },
              { label: 'Cập nhật gần nhất', value: stats?.lastUpdatedAt?.slice(0, 10) ?? '—', Icon: Calendar, color: 'bg-success-50 text-success-600', small: true },
            ].map(({ label, value, Icon, color, small }) => (
              <div key={label} className="bg-white rounded-xl border border-dark-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-dark-500">{label}</p>
                  <p className={`${small ? 'text-sm' : 'text-2xl'} font-bold text-dark-900 mt-1`}>
                    {loading ? '—' : value}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
              </div>
            ))}
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={15} className="shrink-0" /> {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 rounded-lg px-4 py-3 text-sm">
              <Check size={15} className="shrink-0" /> {successMsg}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm bộ tri thức..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white" />
            </div>
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700">
              <option value="">Tất cả phòng ban</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="flex-1" />
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
              <Download size={14} /> Xuất Excel
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              <Plus size={14} /> Tạo bộ tri thức
            </button>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-dark-400">
              <Loader2 size={20} className="animate-spin" /> Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-400">
              <BookOpen size={44} className="text-dark-200" />
              <p className="text-sm">Chưa có bộ tri thức nào.</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {items.map(kb => (
                <KBCard
                  key={kb.id}
                  kb={kb}
                  onClick={() => router.push(`/tri-thuc/${kb.id}`)}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {showCreate && (
        <CreateKBModal
          onClose={() => setShowCreate(false)}
          onSave={createKb}
          saving={creating}
          error={error}
        />
      )}
    </div>
  );
}
