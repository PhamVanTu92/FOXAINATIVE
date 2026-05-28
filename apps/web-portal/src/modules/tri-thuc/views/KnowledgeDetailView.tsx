'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronRight, FileText, Upload, Edit2, Trash2,
  Search, Loader2, AlertCircle, Check, X, Shield, Download,
} from 'lucide-react';
import { useKnowledgeDetail } from '../hooks/useKnowledgeDetail';
import { knowledgeFilesApi } from '@/lib/knowledge-api';
import type { KnowledgeFile, DepartmentRef } from '@/lib/knowledge-api';

// ─── File type config ─────────────────────────────────────────────────────────

const FILE_TYPE_CFG: Record<string, { color: string; bg: string }> = {
  Word:       { color: 'text-primary-700',  bg: 'bg-primary-50' },
  Excel:      { color: 'text-success-700',  bg: 'bg-success-50' },
  PDF:        { color: 'text-danger-700',   bg: 'bg-danger-50' },
  Image:      { color: 'text-violet-700',   bg: 'bg-violet-50' },
  PowerPoint: { color: 'text-orange-700',   bg: 'bg-orange-50' },
  Text:       { color: 'text-teal-700',     bg: 'bg-teal-50' },
};

function FileTypeBadge({ type }: { type: string }) {
  const cfg = FILE_TYPE_CFG[type] ?? { color: 'text-dark-600', bg: 'bg-dark-100' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md ${cfg.bg} ${cfg.color}`}>
      {type}
    </span>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

const FILE_TYPES = ['Word', 'Excel', 'PDF', 'Image', 'PowerPoint', 'Text'];

function UploadModal({
  onClose, onUpload, uploading, error,
}: {
  onClose: () => void;
  onUpload: (file: File, fileType: string) => void;
  uploading: boolean;
  error: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('Word');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    onUpload(file, fileType);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
          <h2 className="font-semibold text-dark-800">Tải lên tệp</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Chọn tệp <span className="text-danger-600">*</span>
            </label>
            <input type="file"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              required
              className="w-full text-sm text-dark-700 border border-dark-200 rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Loại tệp</label>
            <select value={fileType} onChange={e => setFileType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700">
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={uploading || !file}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Tải lên
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── File permissions modal ───────────────────────────────────────────────────

function FilePermissionsModal({
  file, departments, onClose, onSave, saving,
}: {
  file: KnowledgeFile;
  departments: DepartmentRef[];
  onClose: () => void;
  onSave: (fileId: string, selected: DepartmentRef[]) => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(file.permissions?.map(p => p.departmentId) ?? [])
  );

  function toggle(dept: DepartmentRef) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(dept.departmentId) ? next.delete(dept.departmentId) : next.add(dept.departmentId);
      return next;
    });
  }

  function handleSave() {
    const chosen = departments.filter(d => selected.has(d.departmentId));
    onSave(file.id, chosen);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary-600" />
            <h2 className="font-semibold text-dark-800">Phân quyền tệp tri thức</h2>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="text-xs text-dark-500 truncate">
            <span className="font-medium text-dark-700">{file.fileName}</span>
          </p>
          {departments.length === 0 ? (
            <p className="text-sm text-dark-400 text-center py-4">Chưa có phòng ban nào được cấu hình.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {departments.map(dept => (
                <label key={dept.departmentId}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-dark-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.has(dept.departmentId)}
                    onChange={() => toggle(dept)}
                    className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500 accent-primary-600"
                  />
                  <span className="text-sm text-dark-700">{dept.departmentName}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2.5">
            <AlertCircle size={14} className="text-primary-500 shrink-0 mt-0.5" />
            <p className="text-xs text-primary-700">Để trống = tất cả phòng ban đều được sử dụng tệp này.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-100">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
            Lưu phân quyền
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteFileModal({
  file, onClose, onConfirm, deleting,
}: {
  file: KnowledgeFile;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
          <h2 className="font-semibold text-dark-800">Xóa tệp</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-dark-600">
            Bạn có chắc muốn xóa tệp{' '}
            <strong className="text-dark-900">{file.fileName}</strong>?
            Hành động này không thể hoàn tác.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-100">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-60 transition-colors">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Xóa tệp
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function KnowledgeDetailView({ kbId }: { kbId: string }) {
  const router = useRouter();
  const {
    kb, files, loading, error, successMsg,
    search, setSearch,
    fileTypeFilter, setFileTypeFilter,
    typeCounts,
    showUpload, setShowUpload,
    uploading, uploadFile,
    deletingFile, setDeletingFile,
    deleting, confirmDelete,
    permFile, setPermFile,
    savingPermissions, saveFilePermissions,
    orgDepts,
  } = useKnowledgeDetail(kbId);

  const TYPE_STATS = [
    { key: 'Word',  label: 'Word',     color: 'text-primary-600',  bg: 'bg-primary-50',  border: 'border-primary-200' },
    { key: 'Excel', label: 'Excel',    color: 'text-success-600',  bg: 'bg-success-50',  border: 'border-success-200' },
    { key: 'PDF',   label: 'PDF',      color: 'text-danger-600',   bg: 'bg-danger-50',   border: 'border-danger-200' },
    { key: 'Image', label: 'Hình ảnh', color: 'text-violet-600',   bg: 'bg-violet-50',   border: 'border-violet-200' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-dark-50">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-dark-200">
        <span className="text-sm text-dark-400">Tri thức AI</span>
        <ChevronRight size={14} className="text-dark-300" />
        <button onClick={() => router.push('/tri-thuc')}
          className="text-sm text-dark-400 hover:text-primary-600 transition-colors">
          Quản lý tri thức
        </button>
        <ChevronRight size={14} className="text-dark-300" />
        <span className="text-sm font-medium text-dark-700 truncate max-w-[240px]">
          {kb?.name ?? '...'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/tri-thuc')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors shrink-0">
                <ArrowLeft size={14} /> Quay lại
              </button>
              <div>
                <h1 className="text-lg font-semibold text-dark-800">{kb?.name ?? '...'}</h1>
                <p className="text-xs text-dark-400 mt-0.5">
                  {kb?.code} · Quản lý bởi: {kb?.managingDepartmentName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
                <Edit2 size={14} /> Sửa bộ tri thức
              </button>
              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                <Upload size={14} /> Tải lên tệp
              </button>
            </div>
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

          {/* Type stats */}
          <div className="flex gap-3">
            {TYPE_STATS.map(({ key, label, color, bg, border }) => {
              const count = typeCounts[key as keyof typeof typeCounts] ?? 0;
              const isActive = fileTypeFilter === key;
              return (
                <button key={key}
                  onClick={() => setFileTypeFilter(isActive ? '' : key)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all ${
                    isActive
                      ? `${bg} ${border} shadow-sm`
                      : 'bg-white border-dark-200 hover:border-dark-300'
                  }`}
                >
                  <FileText size={16} className={color} />
                  <div className="text-left">
                    <p className={`text-xl font-bold ${color}`}>{loading ? '—' : count}</p>
                    <p className="text-xs text-dark-500">{label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm tệp..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white" />
            </div>
            <select value={fileTypeFilter} onChange={e => setFileTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-dark-700">
              <option value="">Tất cả loại tệp</option>
              {['Word', 'Excel', 'PDF', 'Image', 'PowerPoint', 'Text'].map(t =>
                <option key={t} value={t}>{t}</option>
              )}
            </select>
          </div>

          {/* Files table */}
          <div className="bg-white rounded-xl border border-dark-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-50 border-b border-dark-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-10">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Tên tệp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-24">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-24">Kích thước</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide w-28">Ngày tải lên</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wide">Phân quyền phòng ban</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-dark-500 uppercase tracking-wide w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-dark-400 text-sm">
                    <Loader2 size={18} className="animate-spin inline mr-2" /> Đang tải...
                  </td></tr>
                ) : files.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-14">
                    <FileText className="w-10 h-10 text-dark-200 mx-auto mb-2" />
                    <p className="text-dark-400 text-sm">Chưa có tệp nào.</p>
                  </td></tr>
                ) : (
                  files.map((file, idx) => (
                    <tr key={file.id} className="border-b last:border-0 hover:bg-dark-50 transition-colors">
                      <td className="px-4 py-3 text-dark-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-dark-400 shrink-0" />
                          <span className="text-dark-700 font-medium truncate max-w-[300px]">{file.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <FileTypeBadge type={file.fileType} />
                      </td>
                      <td className="px-4 py-3 text-dark-500 text-xs">
                        {file.fileSizeMb ? `${file.fileSizeMb.toFixed(1)} MB` : '—'}
                      </td>
                      <td className="px-4 py-3 text-dark-500 text-xs">
                        {file.uploadedAt?.slice(0, 10) ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {file.permissions?.map(p => (
                            <span key={p.departmentId}
                              className="text-xs px-2 py-0.5 bg-dark-100 text-dark-600 rounded-md truncate max-w-[140px]">
                              {p.departmentName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={knowledgeFilesApi.downloadUrl(kbId, file.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-success-600 hover:bg-success-50 rounded-md transition-colors"
                            title="Tải xuống"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={() => setPermFile(file)}
                            className="p-1.5 text-dark-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                            title="Phân quyền"
                          >
                            <Shield size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingFile(file)}
                            className="p-1.5 text-dark-400 hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUpload={uploadFile}
          uploading={uploading}
          error={error}
        />
      )}

      {/* Delete confirm modal */}
      {deletingFile && (
        <DeleteFileModal
          file={deletingFile}
          onClose={() => setDeletingFile(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}

      {/* File permissions modal */}
      {permFile && (
        <FilePermissionsModal
          file={permFile}
          departments={orgDepts}
          onClose={() => setPermFile(null)}
          onSave={saveFilePermissions}
          saving={savingPermissions}
        />
      )}
    </div>
  );
}
