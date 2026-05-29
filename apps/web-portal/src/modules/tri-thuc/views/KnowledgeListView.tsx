'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, FileText, Users, Calendar, Search, Download,
  Plus, X, Check, Loader2, AlertCircle, ChevronRight, Lock,
} from 'lucide-react';
import { useKnowledgeList } from '../hooks/useKnowledgeList';
import type { DeptOption } from '../hooks/useKnowledgeList';
import type { KnowledgeBase, KbFileCounts, CreateKbPayload } from '@/lib/knowledge-api';
import { useRoutePermission } from '@/hooks/usePermission';

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
  onClose, onSave, saving, error, orgDepts,
}: {
  onClose: () => void;
  onSave: (p: CreateKbPayload) => void;
  saving: boolean;
  error: string;
  orgDepts: DeptOption[];
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managingId, setManagingId] = useState('');
  const [permIds, setPermIds] = useState<Set<string>>(new Set());

  function togglePerm(id: string) {
    setPermIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const managing = orgDepts.find(d => d.id === managingId);
    const permitted = orgDepts.filter(d => permIds.has(d.id));
    onSave({
      code: code.toUpperCase(),
      name,
      description: description || undefined,
      managingDepartmentId: managing?.id ?? managingId,
      managingDepartmentName: managing?.name ?? managingId,
      permittedDepartments: permitted.length
        ? permitted.map(d => ({ departmentId: d.id, departmentName: d.name }))
        : undefined,
    });
  }

  const inputCls = 'w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-default shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50">
              <BookOpen size={16} className="text-teal-600" />
            </div>
            <h2 className="font-semibold text-content-primary">Tạo bộ tri thức mới</h2>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-secondary"><X size={18} /></button>
        </div>

        {/* Body */}
        <form id="create-kb-form" onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Mã + Tên — same row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                Mã bộ tri thức <span className="text-danger-600">*</span>
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="VD: KB006"
                required
                pattern="[A-Z0-9\-_]+"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                Tên bộ tri thức <span className="text-danger-600">*</span>
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="VD: Tri thức Pháp lý"
                required
                className={inputCls}
              />
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về bộ tri thức này"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Phòng ban quản lý */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Phòng ban quản lý <span className="text-danger-600">*</span>
            </label>
            <select
              value={managingId}
              onChange={e => setManagingId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">-- Chọn phòng ban --</option>
              {orgDepts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Phân quyền truy cập */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary mb-1">
              <Lock size={13} className="text-content-muted" />
              Phân quyền truy cập theo phòng ban
              <span className="text-content-muted font-normal text-xs">(để trống = tất cả được dùng)</span>
            </label>
            <div className="border border-default rounded-lg max-h-44 overflow-y-auto bg-surface">
              {orgDepts.length === 0 ? (
                <p className="text-xs text-content-muted px-3 py-3 text-center">Chưa có dữ liệu phòng ban</p>
              ) : (
                orgDepts.map(d => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-subtle cursor-pointer border-b border-strong last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={permIds.has(d.id)}
                      onChange={() => togglePerm(d.id)}
                      className="w-4 h-4 rounded border-default text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-sm text-content-secondary">{d.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-strong shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
          >
            <X size={14} /> Hủy
          </button>
          <button
            type="submit"
            form="create-kb-form"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Tạo
          </button>
        </div>
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
      className="bg-surface rounded-xl border border-default p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-teal-50 shrink-0">
          <BookOpen size={20} className="text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-content-primary leading-snug line-clamp-2">{kb.name}</h3>
          {kb.description && (
            <p className="text-xs text-content-muted mt-1 line-clamp-2">{kb.description}</p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-content-muted border-t border-strong pt-2.5">
        <span className="font-mono font-medium text-content-secondary">#{kb.code}</span>
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
          <p className="text-xs text-content-muted mb-1.5">Phân quyền:</p>
          <div className="flex flex-wrap gap-1">
            {kb.permissions.slice(0, 3).map(d => (
              <span key={d.departmentId}
                className="text-xs px-2 py-0.5 bg-subtle text-content-secondary rounded-md truncate max-w-[150px]">
                {d.departmentName}
              </span>
            ))}
            {kb.permissions.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-subtle text-content-muted rounded-md">
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
    orgDepts,
    exportExcel,
  } = useKnowledgeList();

  const canCreate = useRoutePermission('CREATE');
  const canExport = useRoutePermission('EXPORT');

  return (
    <div className="flex flex-col h-full bg-subtle">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 bg-surface border-b border-default">
        <span className="text-sm text-content-muted">Tri thức AI</span>
        <ChevronRight size={14} className="text-content-muted" />
        <span className="text-sm font-medium text-content-secondary">Quản lý tri thức</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Tổng bộ tri thức', value: stats?.totalKnowledgeBases ?? items.length, Icon: BookOpen, color: 'bg-teal-50 text-teal-600' },
              { label: 'Tổng tệp tri thức', value: stats?.totalFiles ?? '—', Icon: FileText, color: 'bg-primary-50 text-primary-600' },
              { label: 'Phòng ban sử dụng', value: stats?.departmentsUsingCount ?? departments.length, Icon: Users, color: 'bg-violet-50 text-violet-600' },
              { label: 'Cập nhật gần nhất', value: stats?.lastUpdatedAt?.slice(0, 10) ?? '—', Icon: Calendar, color: 'bg-success-50/10 text-success-600', small: true },
            ].map(({ label, value, Icon, color, small }) => (
              <div key={label} className="bg-surface rounded-xl border border-default px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-content-muted">{label}</p>
                  <p className={`${small ? 'text-sm' : 'text-2xl'} font-bold text-content-primary mt-1`}>
                    {loading ? '—' : value}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
              </div>
            ))}
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={15} className="shrink-0" /> {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 bg-success-50/10 border border-success-500/30 text-success-700 rounded-lg px-4 py-3 text-sm">
              <Check size={15} className="shrink-0" /> {successMsg}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm bộ tri thức..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content-primary" />
            </div>
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-secondary">
              <option value="">Tất cả phòng ban</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="flex-1" />
            {canExport && (
              <button onClick={exportExcel}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
                <Download size={14} /> Xuất Excel
              </button>
            )}
            {canCreate && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                <Plus size={14} /> Tạo bộ tri thức
              </button>
            )}
          </div>

          {/* Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-content-muted">
              <Loader2 size={20} className="animate-spin" /> Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-content-muted">
              <BookOpen size={44} className="text-content-muted opacity-50" />
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
          orgDepts={orgDepts}
        />
      )}
    </div>
  );
}
