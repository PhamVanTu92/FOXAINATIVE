'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, FileText, Users, Calendar, Search, Download,
  Plus, X, Check, Loader2, AlertCircle, ChevronRight, Lock,
  Database, FileArchive, Trash2, Pencil,
} from 'lucide-react';
import { useKnowledgeList } from '../hooks/useKnowledgeList';
import type { DeptOption } from '../hooks/useKnowledgeList';
import type {
  KnowledgeBase, KbFileCounts, CreateKbPayload,
  KbGlobalStats, KnowledgeFile, AllFileCounts,
} from '@/lib/knowledge-api';
import { knowledgeBasesApi, knowledgeFilesApi, knowledgeFilesStandaloneApi } from '@/lib/knowledge-api';
import { useRoutePermission } from '@/hooks/usePermission';
import { InfiniteScrollSelect } from '@/components/InfiniteScrollSelect';
import type { SelectOption } from '@/components/InfiniteScrollSelect';

// ─── File type badges ─────────────────────────────────────────────────────────

const FILE_TYPE_CFG: Record<string, { label: string; color: string }> = {
  word:       { label: 'Word',        color: 'bg-primary-100 text-primary-700' },
  excel:      { label: 'Excel',       color: 'bg-success-100 text-success-700' },
  pdf:        { label: 'PDF',         color: 'bg-danger-100 text-danger-700' },
  image:      { label: 'Ảnh',         color: 'bg-violet-100 text-violet-700' },
  powerPoint: { label: 'PowerPoint',  color: 'bg-orange-100 text-orange-700' },
  text:       { label: 'Text',        color: 'bg-dark-100 text-dark-600' },
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

// ─── Total KB Card ────────────────────────────────────────────────────────────

function TotalKbCard({ stats, onClick }: { stats: KbGlobalStats | null; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 flex flex-col gap-3
        hover:shadow-lg transition-all cursor-pointer ring-2 ring-teal-400/20"
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-white/20 shrink-0">
          <Database size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white leading-snug">Tổng tri thức</h3>
          <p className="text-xs text-teal-100 mt-1">Tất cả bộ tri thức trong hệ thống</p>
        </div>
        <ChevronRight size={16} className="text-teal-200 shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-3 text-xs text-teal-100 border-t border-white/20 pt-2.5">
        <span className="flex items-center gap-1 font-medium text-white">
          <BookOpen size={11} /> {stats?.totalKnowledgeBases ?? '—'} bộ
        </span>
        <span className="flex items-center gap-1">
          <FileText size={11} /> {stats?.totalFiles ?? '—'} tệp
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={11} /> {stats?.lastUpdatedAt?.slice(0, 10) ?? '—'}
        </span>
      </div>

      {stats && (
        <div className="flex items-center gap-1.5 text-xs text-teal-100">
          <Users size={11} />
          <span>{stats.departmentsUsingCount} phòng ban sử dụng</span>
        </div>
      )}
    </div>
  );
}

// ─── All Files Modal ───────────────────────────────────────────────────────────

const FILE_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'Word', label: 'Word' },
  { value: 'Excel', label: 'Excel' },
  { value: 'PDF', label: 'PDF' },
  { value: 'Image', label: 'Ảnh' },
  { value: 'PowerPoint', label: 'PowerPoint' },
  { value: 'Text', label: 'Text' },
];

function AllFilesModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [fileType, setFileType] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<KnowledgeFile[]>([]);
  const [counts, setCounts] = useState<AllFileCounts | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingFile, setEditingFile] = useState<KnowledgeFile | null>(null);
  const [permanentDeleteFile, setPermanentDeleteFile] = useState<KnowledgeFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    knowledgeBasesApi.allFiles({ search: search || undefined, fileType: fileType || undefined, page, pageSize: PAGE_SIZE })
      .then(res => {
        setItems(res.items);
        setTotal(res.total);
        setCounts(res.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, fileType, page, refreshKey]);

  useEffect(() => { setPage(1); }, [search, fileType]);

  const handleSaveEdit = async (fileId: string, fileName: string, targetKnowledgeBaseId: string) => {
    const body: { fileName?: string; targetKnowledgeBaseId?: string } = {};
    if (fileName !== editingFile?.fileName) body.fileName = fileName;
    if (targetKnowledgeBaseId !== editingFile?.knowledgeBaseId) body.targetKnowledgeBaseId = targetKnowledgeBaseId;
    if (!Object.keys(body).length) { setEditingFile(null); return; }
    const updated = await knowledgeFilesApi.update(fileId, body);
    setItems(prev => prev.map(f => f.id === fileId ? { ...f, ...updated } : f));
    setEditingFile(null);
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteFile) return;
    setDeleting(true);
    try {
      await knowledgeFilesStandaloneApi.remove(permanentDeleteFile.id);
      setPermanentDeleteFile(null);
      setRefreshKey(k => k + 1);
    } catch { /* lỗi im lặng — có thể thêm toast sau */ }
    finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200 shrink-0">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-teal-600" />
            <h2 className="font-semibold text-dark-800">Tổng tri thức — Tất cả tệp</h2>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Counts bar */}
        {counts && (
          <div className="px-6 py-3 border-b border-dark-100 flex flex-wrap gap-2 shrink-0">
            {Object.entries(counts).filter(([k]) => k !== 'total').map(([k, v]) => {
              const cfg = FILE_TYPE_CFG[k];
              if (!cfg || !v) return null;
              return (
                <span key={k} className={`text-xs font-medium px-2 py-0.5 rounded-md ${cfg.color}`}>
                  {cfg.label} ×{v}
                </span>
              );
            })}
            <span className="text-xs text-dark-500 ml-1 self-center">
              Tổng: {counts.total} tệp
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-dark-100 flex items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên tệp..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          <select value={fileType} onChange={e => setFileType(e.target.value)}
            className="px-3 py-2 text-sm border border-dark-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700">
            {FILE_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-dark-400">
              <Loader2 size={18} className="animate-spin" /> Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-dark-400">
              <FileArchive size={36} className="opacity-40" />
              <p className="text-sm">Không tìm thấy tệp nào.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-100 border-b border-primary-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Tên tệp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Bộ tri thức</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Kích thước</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Ngày tải</th>
                </tr>
              </thead>
              <tbody>
                {items.map(f => {
                  const typeLower = f.fileType.toLowerCase();
                  const cfg = FILE_TYPE_CFG[typeLower === 'powerpoint' ? 'powerPoint' : typeLower];
                  return (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-dark-50 transition-colors">
                      <td className="px-4 py-3 text-dark-800 font-medium max-w-[220px] truncate">
                        {f.fileName}
                      </td>
                      <td className="px-4 py-3 text-dark-500 text-xs max-w-[160px] truncate">
                        {f.knowledgeBaseName ?? <span className="italic text-dark-300">Chưa phân loại</span>}
                      </td>
                      <td className="px-4 py-3">
                        {cfg && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-dark-500 text-xs whitespace-nowrap">
                        {f.fileSizeMb?.toFixed(1)} MB
                      </td>
                      <td className="px-4 py-3 text-dark-500 text-xs whitespace-nowrap">
                        {f.uploadedAt?.slice(0, 10)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-dark-100 shrink-0">
            <span className="text-xs text-dark-500">
              Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
            </span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 border border-dark-200 rounded hover:bg-dark-50 disabled:opacity-40 text-sm">‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-2.5 py-1 border rounded text-sm ${p === page
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-dark-200 hover:bg-dark-50'}`}>{p}</button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 border border-dark-200 rounded hover:bg-dark-50 disabled:opacity-40 text-sm">›</button>
            </div>
          </div>
        )}
      </div>
    </div>

    {editingFile && (
      <EditFileModal
        file={editingFile}
        onSave={handleSaveEdit}
        onClose={() => setEditingFile(null)}
      />
    )}

    {/* Confirm xóa vĩnh viễn */}
    {permanentDeleteFile && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 p-2 rounded-full bg-danger-50">
                <Trash2 size={18} className="text-danger-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dark-800">Xóa vĩnh viễn tệp</h3>
                <p className="text-sm text-dark-500 mt-1.5">
                  Bạn có chắc muốn xóa vĩnh viễn{' '}
                  <span className="font-medium text-dark-800">&quot;{permanentDeleteFile.fileName}&quot;</span>?
                </p>
                <p className="text-xs text-danger-600 mt-1">Tệp sẽ bị xóa hoàn toàn khỏi hệ thống, không thể hoàn tác.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-dark-100">
            <button
              onClick={() => setPermanentDeleteFile(null)}
              disabled={deleting}
              className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handlePermanentDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Xóa vĩnh viễn
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Edit File Modal ──────────────────────────────────────────────────────────

function EditFileModal({
  file, onSave, onClose,
}: {
  file: KnowledgeFile;
  onSave: (fileId: string, fileName: string, targetKnowledgeBaseId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [fileName, setFileName] = useState(file.fileName ?? '');
  const [targetKbId, setTargetKbId] = useState(file.knowledgeBaseId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChange = fileName.trim() !== (file.fileName ?? '') || targetKbId !== file.knowledgeBaseId;

  const loadKbOptions = useCallback(async (search: string, page: number) => {
    const res = await knowledgeBasesApi.list({ search: search || undefined, page, pageSize: 10 });
    return {
      items: res.items.map((kb): SelectOption => ({ value: kb.id, label: kb.name })),
      hasMore: page * res.pageSize < res.total,
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) { setError('Tên tệp không được để trống.'); return; }
    if (fileName.trim().length > 500) { setError('Tên tệp tối đa 500 ký tự.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(file.id, fileName.trim(), targetKbId);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Có lỗi xảy ra.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-primary-600" />
            <h3 className="font-semibold text-dark-800 text-sm">Đổi tên / Chuyển bộ tri thức</h3>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600 p-1 rounded">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1.5">Tên tệp</label>
            <input
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              maxLength={500}
              className="w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1.5">Bộ tri thức</label>
            <InfiniteScrollSelect
              value={targetKbId}
              onChange={setTargetKbId}
              selectedLabel={file.knowledgeBaseName}
              loadOptions={loadKbOptions}
              placeholder="Chọn bộ tri thức..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={saving || !hasChange}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  name, onConfirm, onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 p-2 rounded-full bg-danger-50">
              <Trash2 size={18} className="text-danger-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dark-800">Xóa bộ tri thức</h3>
              <p className="text-sm text-dark-500 mt-1.5">
                Bạn có chắc muốn xóa{' '}
                <span className="font-medium text-dark-800">&quot;{name}&quot;</span>?
                <br />
                <span className="text-danger-600 text-xs">Hành động này không thể hoàn tác.</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-dark-100">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg
              hover:bg-dark-50 transition-colors">
            Hủy
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-danger-600 text-white rounded-lg
              hover:bg-danger-700 transition-colors">
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KB Card ──────────────────────────────────────────────────────────────────

function KBCard({ kb, onClick, onDelete }: { kb: KnowledgeBase; onClick: () => void; onDelete: () => void }) {
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
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 p-1.5 text-dark-400 hover:text-danger-600 hover:bg-danger-50
            rounded-lg transition-colors"
          title="Xóa bộ tri thức"
        >
          <Trash2 size={14} />
        </button>
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
    deleteKb,
    orgDepts,
    exportExcel,
  } = useKnowledgeList();

  const [showAllFiles, setShowAllFiles] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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
              { label: 'Cập nhật gần nhất', value: stats?.lastUpdatedAt?.slice(0, 10) ?? '—', Icon: Calendar, color: 'bg-primary-50 text-success-600', small: true },
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
            <div className="flex items-center gap-2 bg-primary-50 border border-success-500/30 text-success-700 rounded-lg px-4 py-3 text-sm">
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
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {/* Khối tổng tri thức luôn hiển thị đầu tiên */}
            <TotalKbCard stats={stats} onClick={() => setShowAllFiles(true)} />

            {loading ? (
              <div className="col-span-full flex items-center justify-center py-16 gap-2 text-content-muted">
                <Loader2 size={20} className="animate-spin" /> Đang tải...
              </div>
            ) : items.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 text-content-muted">
                <BookOpen size={44} className="text-content-muted opacity-50" />
                <p className="text-sm">Chưa có bộ tri thức nào.</p>
              </div>
            ) : (
              items.map(kb => (
                <KBCard
                  key={kb.id}
                  kb={kb}
                  onClick={() => router.push(`/tri-thuc/${kb.id}`)}
                  onDelete={() => setDeleteTarget({ id: kb.id, name: kb.name })}
                />
              ))
            )}
          </div>

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

      {showAllFiles && (
        <AllFilesModal onClose={() => setShowAllFiles(false)} />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteKb(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
