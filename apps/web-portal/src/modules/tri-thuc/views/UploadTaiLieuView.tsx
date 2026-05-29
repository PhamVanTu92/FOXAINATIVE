'use client';
import {
  Upload, ChevronRight, UploadCloud, Play, Loader2,
  CheckCircle, AlertCircle, X, FileText, FileSpreadsheet,
  Image as ImageIcon, File, Link2, ScanLine, CheckCheck, Inbox,
} from 'lucide-react';
import Link from 'next/link';
import { useUploadTaiLieu, QueueItem, UploadStatus } from '../hooks/useUploadTaiLieu';
import { KnowledgeBase } from '@/lib/knowledge-api';
import { useRoutePermission } from '@/hooks/usePermission';

// ─── Sub-components ────────────────────────────────────────────────────────────

function FileTypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  if (type === 'PDF') return <FileText size={size} className="text-danger-500" />;
  if (type === 'Word') return <FileText size={size} className="text-primary-500" />;
  if (type === 'Excel') return <FileSpreadsheet size={size} className="text-success-500" />;
  if (type === 'PowerPoint') return <FileText size={size} className="text-warning-500" />;
  if (type === 'Image') return <ImageIcon size={size} className="text-violet-500" />;
  return <File size={size} className="text-content-muted" />;
}

const FILE_TYPE_BADGES = [
  { label: 'PDF',        color: 'bg-danger-50/10 text-danger-700' },
  { label: 'Word',       color: 'bg-primary-50/10 text-primary-700' },
  { label: 'Excel',      color: 'bg-success-50/10 text-success-700' },
  { label: 'PowerPoint', color: 'bg-warning-50/10 text-warning-700' },
  { label: 'TXT / CSV',  color: 'bg-subtle text-content-secondary' },
  { label: 'Ảnh scan',   color: 'bg-warning-50/10 text-warning-700' },
];

const TABS = [
  { label: 'Upload tài liệu',        href: '/tri-thuc/upload',        icon: Upload },
  { label: 'Kết nối dữ liệu tự động', href: '/tri-thuc/ket-noi',       icon: Link2 },
  { label: 'OCR & Chuẩn hóa',         href: '/tri-thuc/ocr-chuan-hoa', icon: ScanLine },
];

function StatusBadge({ status, errorMsg }: { status: UploadStatus; errorMsg?: string }) {
  if (status === 'pending')
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-subtle text-content-muted font-medium">
        Chờ xử lý
      </span>
    );
  if (status === 'uploading')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
        <Loader2 size={10} className="animate-spin" /> Đang tải...
      </span>
    );
  if (status === 'done')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success-50/10 text-success-700 font-medium">
        <CheckCircle size={10} /> Hoàn thành
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-danger-50/10 text-danger-700 font-medium"
      title={errorMsg}
    >
      <AlertCircle size={10} /> Lỗi
    </span>
  );
}

function QueueItemRow({
  item, kbList, onUpdate, onRemove, onProcessOne,
}: {
  item: QueueItem;
  kbList: KnowledgeBase[];
  onUpdate: (id: string, patch: Partial<Pick<QueueItem, 'knowledgeBaseId' | 'title' | 'contentSummary'>>) => void;
  onRemove: (id: string) => void;
  onProcessOne: (item: QueueItem) => void;
}) {
  const locked = item.status === 'uploading' || item.status === 'done';

  return (
    <div className={`border-b border-default last:border-0 px-5 py-4 transition-colors ${
      item.status === 'done'      ? 'bg-success-50/10' :
      item.status === 'error'     ? 'bg-danger-50/10'  :
      item.status === 'uploading' ? 'bg-primary-50/10' : ''
    }`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <FileTypeIcon type={item.fileType} size={20} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: filename + size + status badge */}
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <span className="text-sm font-medium text-content-primary truncate max-w-xs">{item.fileName}</span>
            <span className="text-xs text-content-muted shrink-0">{item.fileSizeMb} MB</span>
            <StatusBadge status={item.status} errorMsg={item.errorMsg} />
          </div>

          {item.status === 'error' && item.errorMsg && (
            <p className="text-xs text-danger-600 mb-2">⚠ {item.errorMsg}</p>
          )}

          {/* Row 2: config fields for pending/error */}
          {!locked && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">
                  Bộ tri thức <span className="text-danger-500">*</span>
                </label>
                <select
                  value={item.knowledgeBaseId}
                  onChange={e => onUpdate(item.id, { knowledgeBaseId: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-default rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
                >
                  <option value="">-- Chọn bộ tri thức --</option>
                  {kbList.map(kb => (
                    <option key={kb.id} value={kb.id}>{kb.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">
                  Tiêu đề <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={item.title}
                  onChange={e => onUpdate(item.id, { title: e.target.value })}
                  placeholder="Nhập tiêu đề tài liệu..."
                  className="w-full px-2.5 py-1.5 text-xs border border-default rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface
                    text-content-primary placeholder:text-content-muted"
                />
              </div>
            </div>
          )}

          {item.status === 'done' && (
            <p className="text-xs text-content-secondary">{item.title}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {(item.status === 'pending' || item.status === 'error') && (
            <button
              onClick={() => onProcessOne(item)}
              className="p-1.5 text-content-muted hover:text-primary-600 hover:bg-primary-50/10 rounded-lg transition-colors"
              title="Tải lên ngay"
            >
              <Play size={13} />
            </button>
          )}
          <button
            onClick={() => onRemove(item.id)}
            disabled={item.status === 'uploading'}
            className="p-1.5 text-content-muted hover:text-danger-600 hover:bg-danger-50/10 rounded-lg transition-colors disabled:opacity-40"
            title="Xóa khỏi hàng đợi"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function UploadTaiLieuView() {
  const {
    queue, kbList, isDragging, processing, successMsg,
    inputRef, pendingCount, errorCount, doneCount, totalCount,
    removeItem, updateItem, processOne, processAll, clearDone,
    openFilePicker, handleDrop, handleDragOver, handleDragLeave, handleFileInput,
  } = useUploadTaiLieu();

  const canCreate = useRoutePermission('CREATE');
  const canDelete = useRoutePermission('DELETE');

  const actionCount = pendingCount + errorCount;

  return (
    <div className="flex flex-col h-full">
      {/* ── Page Header ── */}
      <div className="bg-surface border-b border-default">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 px-6 py-3">
          <span className="text-sm text-content-muted">Cấu hình đầu vào tri thức</span>
          <ChevronRight size={14} className="text-content-muted" />
          <span className="text-sm font-medium text-content-secondary">Upload tài liệu</span>
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 px-6 pb-3">
          <Upload size={20} className="text-primary-600" />
          <h1 className="text-xl font-semibold text-content-primary">Upload tài liệu</h1>
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-1">
          {TABS.map(tab => {
            const isActive = tab.href === '/tri-thuc/upload';
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-content-secondary hover:text-content-primary hover:border-strong'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6 bg-subtle space-y-5">
        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-success-50/10 border border-success-500/30 text-success-700 rounded-lg px-4 py-3 text-sm">
            <CheckCircle size={15} className="shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ── Drop Zone ── */}
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={e => e.key === 'Enter' && openFilePicker()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`bg-surface rounded-xl border-2 border-dashed transition-all cursor-pointer
            flex flex-col items-center justify-center py-12 px-8 gap-3 outline-none
            focus-visible:ring-2 focus-visible:ring-primary-500
            ${isDragging
              ? 'border-primary-400 bg-primary-50/10'
              : 'border-default hover:border-primary-500 hover:bg-subtle/50'
            }`}
        >
          <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-primary-500/20' : 'bg-subtle'}`}>
            <UploadCloud size={32} className={isDragging ? 'text-primary-500' : 'text-content-muted'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-content-primary">Kéo thả hoặc click để chọn tệp</p>
            <p className="text-xs text-content-muted mt-1">Hỗ trợ nhiều loại tài liệu phổ biến</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {FILE_TYPE_BADGES.map(b => (
              <span key={b.label} className={`text-xs px-2.5 py-1 rounded-md font-medium ${b.color}`}>
                {b.label}
              </span>
            ))}
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp"
          />
        </div>

        {/* ── Queue Section ── */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          {/* Queue header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-content-primary">Hàng đợi tải lên</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                totalCount > 0 ? 'bg-primary-100 text-primary-700' : 'bg-subtle text-content-muted'
              }`}>
                {totalCount}
              </span>
              {canDelete && doneCount > 0 && (
                <button
                  onClick={clearDone}
                  className="flex items-center gap-1 text-xs text-content-muted hover:text-danger-500 px-1.5 py-0.5 rounded hover:bg-danger-50/10 transition-colors ml-1"
                >
                  <CheckCheck size={12} /> Xóa đã xong ({doneCount})
                </button>
              )}
            </div>

            {canCreate && (
              <button
                onClick={processAll}
                disabled={processing || actionCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                  bg-primary-600 text-white rounded-lg hover:bg-primary-700
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing
                  ? <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</>
                  : <><Play size={14} /> Xử lý tất cả</>}
              </button>
            )}
          </div>

          {/* Queue items / empty state */}
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Inbox size={40} className="text-content-muted opacity-50 mb-3" />
              <p className="text-sm text-content-muted">Chưa có tài liệu nào trong hàng đợi.</p>
              <p className="text-xs text-content-muted mt-1 opacity-70">Kéo thả hoặc click vào vùng trên để thêm tệp.</p>
            </div>
          ) : (
            queue.map(item => (
              <QueueItemRow
                key={item.id}
                item={item}
                kbList={kbList}
                onUpdate={updateItem}
                onRemove={removeItem}
                onProcessOne={processOne}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
