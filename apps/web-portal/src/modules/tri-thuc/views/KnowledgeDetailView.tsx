'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronRight, FileText, Upload, Edit2, Trash2,
  Search, Loader2, AlertCircle, Check, X, Shield, Download,
  ZoomIn, Table2, Image as ImageIcon,
} from 'lucide-react';
import { useKnowledgeDetail } from '../hooks/useKnowledgeDetail';
import { knowledgeFilesApi } from '@/lib/knowledge-api';
import type { KnowledgeBase, KnowledgeFile, DepartmentRef, CreateKbPayload } from '@/lib/knowledge-api';
import { useRoutePermission } from '@/hooks/usePermission';

// ─── File type config ─────────────────────────────────────────────────────────

const FILE_TYPE_CFG: Record<string, { color: string; bg: string }> = {
  Word:       { color: 'text-primary-700',  bg: 'bg-primary-50' },
  Excel:      { color: 'text-success-700',  bg: 'bg-success-50' },
  PDF:        { color: 'text-danger-700',   bg: 'bg-danger-50' },
  Image:      { color: 'text-violet-700',   bg: 'bg-violet-50' },
  PowerPoint: { color: 'text-orange-700',   bg: 'bg-orange-50' },
  Text:       { color: 'text-teal-700',     bg: 'bg-teal-50' },
};

// ─── File preview helpers ─────────────────────────────────────────────────────

function WordPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setLoading(true); setHtml(null); setErr(false);
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => import('mammoth').then(m => m.convertToHtml({ arrayBuffer: buf })))
      .then(({ value }) => setHtml(value))
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [url]);
  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-neutral-500 animate-spin" /></div>;
  if (err || !html) return <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Không thể đọc nội dung file</div>;
  return <div className="h-full overflow-auto p-6 bg-white text-sm text-neutral-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

function ExcelPreview({ url }: { url: string }) {
  const [sheets, setSheets] = useState<{ name: string; rows: (string | number | null)[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setLoading(true); setSheets([]); setErr(false); setActiveSheet(0);
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => import('xlsx').then(XLSX => {
        const wb = XLSX.read(buf, { type: 'array' });
        return wb.SheetNames.map(name => ({
          name,
          rows: wb.Sheets[name] ? XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[name]!, { header: 1, defval: null }) : [],
        }));
      }))
      .then(setSheets)
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [url]);
  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-neutral-500 animate-spin" /></div>;
  if (err || !sheets.length) return <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Không thể đọc nội dung file</div>;
  const current = sheets[activeSheet];
  const headers = (current?.rows[0] ?? []) as (string | null)[];
  const dataRows = current?.rows.slice(1) ?? [];
  return (
    <div className="h-full flex flex-col overflow-hidden bg-neutral-900">
      {sheets.length > 1 && (
        <div className="flex gap-0.5 px-2 py-1.5 bg-neutral-800 border-b border-neutral-700 overflow-x-auto shrink-0">
          {sheets.map((s, i) => (
            <button key={i} onClick={() => setActiveSheet(i)}
              className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${i === activeSheet ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-700'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="text-xs text-neutral-200 border-collapse">
          <thead className="sticky top-0 bg-neutral-800 z-10">
            <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-medium text-neutral-300 border border-neutral-700 whitespace-nowrap">{h ?? ''}</th>)}</tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-neutral-800/40' : ''}>
                {headers.map((_, ci) => <td key={ci} className="px-3 py-1.5 border border-neutral-700/50 whitespace-nowrap max-w-[200px] truncate">{String(row[ci] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilePreviewModal({ file, fileUrl, onClose }: {
  file: KnowledgeFile;
  fileUrl: string;
  onClose: () => void;
}) {
  const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
  const type = file.fileType;
  const isPdf   = type === 'PDF'   || ext === 'pdf';
  const isImage = type === 'Image' || ['png','jpg','jpeg','gif','webp','tiff'].includes(ext);
  const isWord  = type === 'Word'  || ['doc','docx'].includes(ext);
  const isExcel = type === 'Excel' || ['xls','xlsx','csv'].includes(ext);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-800 border-b border-neutral-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isImage ? <ImageIcon className="w-4 h-4 text-violet-400 shrink-0" /> :
           isExcel ? <Table2 className="w-4 h-4 text-success-400 shrink-0" /> :
           <FileText className="w-4 h-4 text-danger-400 shrink-0" />}
          <span className="text-sm text-neutral-200 truncate">{file.fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-700 hover:bg-neutral-600 px-2.5 py-1 rounded-md transition-colors">
            <ZoomIn className="w-3.5 h-3.5" /> Mở rộng
          </a>
          <a href={fileUrl} download
            className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-700 hover:bg-neutral-600 px-2.5 py-1 rounded-md transition-colors">
            <Download className="w-3.5 h-3.5" /> Tải xuống
          </a>
          <button onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isPdf ? (
          <iframe src={fileUrl} className="w-full h-full border-0" title={file.fileName} />
        ) : isImage ? (
          <div className="h-full overflow-auto flex items-start justify-center p-6 bg-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl} alt={file.fileName} className="max-w-full object-contain rounded shadow-xl" />
          </div>
        ) : isWord ? (
          <WordPreview url={fileUrl} />
        ) : isExcel ? (
          <ExcelPreview url={fileUrl} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-500">
            <FileText className="w-14 h-14 text-neutral-600" />
            <p className="text-sm">Không thể xem trước định dạng này</p>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 underline">
              <Download className="w-3.5 h-3.5" /> Tải file xuống
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function FileTypeBadge({ type }: { type: string }) {
  const cfg = FILE_TYPE_CFG[type] ?? { color: 'text-content-secondary', bg: 'bg-subtle' };
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
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default bg-surface">
          <h2 className="font-semibold text-content-primary">Tải lên tệp</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-secondary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Chọn tệp <span className="text-danger-600">*</span>
            </label>
            <input type="file"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              required
              className="w-full text-sm text-content-secondary border border-default rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Loại tệp</label>
            <select value={fileType} onChange={e => setFileType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-secondary">
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
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
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary-600" />
            <h2 className="font-semibold text-content-primary">Phân quyền tệp tri thức</h2>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-secondary"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Tệp được chọn</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-subtle border border-default rounded-lg">
              <FileText size={16} className="text-content-muted shrink-0" />
              <span className="text-sm font-medium text-content-secondary truncate">{file.fileName}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Phân quyền phòng ban
            </label>
            <div className="border border-default rounded-lg overflow-hidden bg-surface">
              {departments.length === 0 ? (
                <p className="text-sm text-content-muted text-center py-4">Chưa có phòng ban nào được cấu hình.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-strong">
                  {departments.map(dept => (
                    <label key={dept.departmentId}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-subtle transition-colors">
                      <input
                        type="checkbox"
                        checked={selected.has(dept.departmentId)}
                        onChange={() => toggle(dept)}
                        className="w-4 h-4 rounded border-default text-primary-600 focus:ring-primary-500 accent-primary-600"
                      />
                      <span className="text-sm text-content-secondary">{dept.departmentName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2.5">
            <AlertCircle size={14} className="text-primary-500 shrink-0 mt-0.5" />
            <p className="text-xs text-primary-700">Để trống = tất cả phòng ban đều được sử dụng tệp này.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-strong bg-surface">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
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
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default bg-surface">
          <h2 className="font-semibold text-content-primary">Xóa tệp</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-secondary"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-2">
          <p className="text-sm text-content-secondary">
            Bạn có chắc muốn xóa tệp{' '}
            <strong className="text-content-primary">{file.fileName}</strong>?
            Hành động này không thể hoàn tác.
          </p>
          <p className="text-xs text-content-muted">
            Tệp sẽ được gỡ khỏi bộ tri thức này nhưng vẫn còn trong hệ thống.
            Để xóa vĩnh viễn, truy cập <span className="font-medium text-content-secondary">Tổng tri thức</span>.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-strong bg-surface">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-60 transition-colors">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Gỡ khỏi bộ tri thức
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit KB modal ────────────────────────────────────────────────────────────

function EditKbModal({
  kb, orgDepts, onClose, onSave, saving,
}: {
  kb: KnowledgeBase;
  orgDepts: DepartmentRef[];
  onClose: () => void;
  onSave: (dto: Omit<CreateKbPayload, 'code'>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description ?? '');
  const [managingId, setManagingId] = useState(kb.managingDepartmentId);
  const [permIds, setPermIds] = useState<Set<string>>(
    () => new Set(kb.permissions?.map(p => p.departmentId) ?? [])
  );

  function togglePerm(id: string) {
    setPermIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !managingId) return;
    const managingDept = orgDepts.find(d => d.departmentId === managingId);
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      managingDepartmentId: managingId,
      managingDepartmentName: managingDept?.departmentName ?? '',
      permittedDepartments: orgDepts.filter(d => permIds.has(d.departmentId)),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Edit2 size={18} className="text-primary-600" />
            <h2 className="font-semibold text-content-primary">Sửa bộ tri thức</h2>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-secondary"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Mã bộ tri thức</label>
                <input
                  value={kb.code}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-subtle text-content-muted cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  Tên bộ tri thức <span className="text-danger-600">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content-primary" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Mô tả</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content-primary resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                Phòng ban quản lý <span className="text-danger-600">*</span>
              </label>
              <select
                value={managingId}
                onChange={e => setManagingId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-secondary">
                <option value="">-- Chọn phòng ban --</option>
                {orgDepts.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                Phân quyền phòng ban
              </label>
              <div className="border border-default rounded-lg overflow-hidden bg-surface">
                {orgDepts.length === 0 ? (
                  <p className="text-sm text-content-muted text-center py-4">Chưa có phòng ban nào.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto divide-y divide-strong">
                    {orgDepts.map(d => (
                      <label key={d.departmentId}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-subtle transition-colors">
                        <input
                          type="checkbox"
                          checked={permIds.has(d.departmentId)}
                          onChange={() => togglePerm(d.departmentId)}
                          className="w-4 h-4 rounded border-default accent-primary-600"
                        />
                        <span className="text-sm text-content-secondary">{d.departmentName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-content-muted mt-1">Để trống = tất cả phòng ban có quyền truy cập.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-strong shrink-0 bg-surface">
            <button type="button" onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
              <X size={14} /> Hủy
            </button>
            <button type="submit" disabled={saving || !name.trim() || !managingId}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Lưu
            </button>
          </div>
        </form>
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
    showEditKb, setShowEditKb,
    savingKb, updateKb,
  } = useKnowledgeDetail(kbId);

  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);

  const canCreate = useRoutePermission('CREATE');
  const canUpdate = useRoutePermission('UPDATE');
  const canDelete = useRoutePermission('DELETE');
  const canExport = useRoutePermission('EXPORT');

  const TYPE_STATS = [
    { key: 'Word',  label: 'Word',     color: 'text-primary-600',  bg: 'bg-primary-50',  border: 'border-primary-200' },
    { key: 'Excel', label: 'Excel',    color: 'text-success-600',  bg: 'bg-success-50',  border: 'border-success-200' },
    { key: 'PDF',   label: 'PDF',      color: 'text-danger-600',   bg: 'bg-danger-50',   border: 'border-danger-200' },
    { key: 'Image', label: 'Hình ảnh', color: 'text-violet-600',   bg: 'bg-violet-50',   border: 'border-violet-200' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-subtle">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 bg-surface border-b border-default">
        <span className="text-sm text-content-muted">Tri thức AI</span>
        <ChevronRight size={14} className="text-content-muted" />
        <button onClick={() => router.push('/tri-thuc')}
          className="text-sm text-content-muted hover:text-primary-600 transition-colors">
          Quản lý tri thức
        </button>
        <ChevronRight size={14} className="text-content-muted" />
        <span className="text-sm font-medium text-content-secondary truncate max-w-[240px]">
          {kb?.name ?? '...'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/tri-thuc')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors shrink-0">
                <ArrowLeft size={14} /> Quay lại
              </button>
              <div>
                <h1 className="text-lg font-semibold text-content-primary">{kb?.name ?? '...'}</h1>
                <p className="text-xs text-content-muted mt-0.5">
                  {kb?.code} · Quản lý bởi: {kb?.managingDepartmentName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canUpdate && (
                <button
                  onClick={() => setShowEditKb(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
                  <Edit2 size={14} /> Sửa bộ tri thức
                </button>
              )}
              {canCreate && (
                <button onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  <Upload size={14} /> Tải lên tệp
                </button>
              )}
            </div>
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
                      : 'bg-surface border-default hover:border-strong'
                  }`}
                >
                  <FileText size={16} className={color} />
                  <div className="text-left">
                    <p className={`text-xl font-bold ${color}`}>{loading ? '—' : count}</p>
                    <p className="text-xs text-content-muted">{label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm tệp..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content-primary" />
            </div>
            <select value={fileTypeFilter} onChange={e => setFileTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-secondary">
              <option value="">Tất cả loại tệp</option>
              {['Word', 'Excel', 'PDF', 'Image', 'PowerPoint', 'Text'].map(t =>
                <option key={t} value={t}>{t}</option>
              )}
            </select>
          </div>

          {/* Files table */}
          <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-100 border-b border-primary-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-10">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Tên tệp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-24">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-24">Kích thước</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-28">Ngày tải lên</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Phân quyền phòng ban</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-primary-600 uppercase tracking-wide w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-content-muted text-sm">
                    <Loader2 size={18} className="animate-spin inline mr-2" /> Đang tải...
                  </td></tr>
                ) : files.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-14">
                    <FileText className="w-10 h-10 text-content-muted mx-auto mb-2 opacity-50" />
                    <p className="text-content-muted text-sm">Chưa có tệp nào.</p>
                  </td></tr>
                ) : (
                  files.map((file, idx) => (
                    <tr key={file.id} className="border-b border-default last:border-0 hover:bg-subtle transition-colors">
                      <td className="px-4 py-3 text-content-muted text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="flex items-center gap-2 text-left w-full group"
                        >
                          <FileText size={14} className="text-content-muted shrink-0 group-hover:text-primary-500 transition-colors" />
                          <span className="text-content-secondary font-medium truncate max-w-[300px] group-hover:text-primary-600 group-hover:underline transition-colors">
                            {file.fileName}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <FileTypeBadge type={file.fileType} />
                      </td>
                      <td className="px-4 py-3 text-content-muted text-xs">
                        {file.fileSizeMb ? `${file.fileSizeMb.toFixed(1)} MB` : '—'}
                      </td>
                      <td className="px-4 py-3 text-content-muted text-xs">
                        {file.uploadedAt?.slice(0, 10) ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {file.permissions?.map(p => (
                            <span key={p.departmentId}
                              className="text-xs px-2 py-0.5 bg-subtle text-content-secondary rounded-md truncate max-w-[140px]">
                              {p.departmentName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canExport && (
                            <a
                              href={knowledgeFilesApi.downloadUrl(kbId, file.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-success-600 hover:bg-primary-50 rounded-md transition-colors"
                              title="Tải xuống"
                            >
                              <Download size={14} />
                            </a>
                          )}
                          {canUpdate && (
                            <button
                              onClick={() => setPermFile(file)}
                              className="p-1.5 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                              title="Phân quyền"
                            >
                              <Shield size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeletingFile(file)}
                              className="p-1.5 text-content-muted hover:text-danger-600 hover:bg-danger-50/10 rounded-md transition-colors"
                              title="Xóa"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* Edit KB modal */}
      {showEditKb && kb && (
        <EditKbModal
          kb={kb}
          orgDepts={orgDepts}
          onClose={() => setShowEditKb(false)}
          onSave={updateKb}
          saving={savingKb}
        />
      )}

      {/* File preview */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          fileUrl={knowledgeFilesApi.downloadUrl(kbId, previewFile.id)}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
