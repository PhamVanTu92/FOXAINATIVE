'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, FileText, Loader2, AlertCircle, Check, ChevronRight,
  Clock, Eye, Archive, RotateCcw, Edit2, X, BookOpen,
  CheckCircle2, Circle, ArrowLeftRight, Download, Send,
} from 'lucide-react';
import { useKiemDuyet } from '../hooks/useKiemDuyet';
import { knowledgeDocumentsApi } from '@/lib/knowledge-api';
import type { KnowledgeDocument, DocStatus, DocumentVersion } from '@/lib/knowledge-api';
import type { DocDetailTab } from '../hooks/useKiemDuyet';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<DocStatus, { label: string; color: string; dot: string; Icon: React.ElementType }> = {
  Draft:    { label: 'Draft',    color: 'bg-subtle text-content-secondary border border-default',         dot: 'bg-content-muted',    Icon: Edit2 },
  Review:   { label: 'Review',   color: 'bg-warning-50/10 text-warning-700 border border-warning-500/30', dot: 'bg-warning-500', Icon: Eye },
  Approved: { label: 'Approved', color: 'bg-success-50/10 text-success-700 border border-success-500/30', dot: 'bg-success-500', Icon: CheckCircle2 },
  Archived: { label: 'Archived', color: 'bg-subtle text-content-muted border border-default',          dot: 'bg-content-muted',    Icon: Archive },
};

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      <cfg.Icon size={10} /> {cfg.label}
    </span>
  );
}

// ─── Approval timeline ────────────────────────────────────────────────────────

const TIMELINE_STEPS: DocStatus[] = ['Draft', 'Review', 'Approved', 'Archived'];

function ApprovalTimeline({ status }: { status: DocStatus }) {
  const currentIdx = TIMELINE_STEPS.indexOf(status);
  return (
    <div className="flex items-center justify-center gap-0 py-6">
      {TIMELINE_STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const cfg = STATUS_CFG[step];
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-2 w-28">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                isActive
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : isDone
                  ? 'bg-subtle border-strong text-content-secondary'
                  : 'bg-surface border-default text-content-muted'
              }`}>
                {isActive ? <cfg.Icon size={18} /> : isDone ? <Check size={16} /> : <Circle size={16} />}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-primary-700' : isDone ? 'text-content-secondary' : 'text-content-muted'}`}>
                {cfg.label}
              </span>
            </div>
            {idx < TIMELINE_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 ${idx < currentIdx ? 'bg-strong' : 'bg-default'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Document list item ───────────────────────────────────────────────────────

function DocListItem({
  doc,
  active,
  onClick,
}: {
  doc: KnowledgeDocument;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-default transition-colors ${
        active ? 'bg-primary-50 border-r-2 border-r-primary-500' : 'hover:bg-subtle'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium leading-snug line-clamp-2 ${active ? 'text-primary-700' : 'text-content-primary'}`}>
          {doc.title}
        </p>
        <StatusBadge status={doc.status} />
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-content-muted flex-wrap">
        <span className="font-mono text-content-secondary">{doc.currentVersion}</span>
        <span className="text-content-muted">·</span>
        <span className="truncate max-w-[120px]">{doc.knowledgeBaseName}</span>
        <span className="text-content-muted">·</span>
        <span>{doc.authorName}</span>
        <span className="text-content-muted">·</span>
        <span>{doc.updatedAt?.slice(0, 10)}</span>
      </div>
    </button>
  );
}

// ─── Versions tab ─────────────────────────────────────────────────────────────

function VersionsList({
  versions,
  loading,
}: {
  versions: DocumentVersion[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-content-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Đang tải...
      </div>
    );
  }
  if (versions.length === 0) {
    return <p className="text-center text-sm text-content-muted py-12">Chưa có lịch sử phiên bản.</p>;
  }
  return (
    <div className="divide-y divide-strong">
      {versions.map((v, idx) => (
        <div key={v.id} className="px-6 py-4 flex items-start gap-4">
          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-primary-600' : 'bg-strong'}`}>
              {v.versionNumber}
            </div>
            {idx < versions.length - 1 && <div className="w-0.5 h-6 bg-default" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-content-secondary">{v.changeNote || 'Không có ghi chú'}</p>
            <p className="text-xs text-content-muted mt-1">{v.createdBy} · {v.createdAt?.slice(0, 10)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── File preview ─────────────────────────────────────────────────────────────

const IMAGE_TYPES: string[] = ['Image'];
const TEXT_TYPES: string[] = ['Word', 'Excel', 'PowerPoint', 'Text'];

function useBlobUrl(apiUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!apiUrl) return;
    let revoked = false;
    setFetchError(false);
    setBlobUrl(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    fetch(apiUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(b => {
        if (!revoked) setBlobUrl(URL.createObjectURL(b));
      })
      .catch(() => { if (!revoked) setFetchError(true); });
    return () => {
      revoked = true;
      setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [apiUrl]);

  return { blobUrl, fetchError };
}

function NoFileState({ fileType }: { fileType: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-content-muted">
      <FileText size={36} className="text-content-muted opacity-50" />
      <p className="text-sm">Chưa có file {fileType} đính kèm.</p>
    </div>
  );
}

function FilePreview({ doc }: { doc: KnowledgeDocument }) {
  const hasFile = !!doc.storagePath;
  const apiUrl = knowledgeDocumentsApi.fileUrl(doc.id);
  const { blobUrl, fetchError } = useBlobUrl(hasFile ? apiUrl : null);

  if (!hasFile) return <NoFileState fileType={doc.fileType} />;

  if (doc.fileType === 'PDF') {
    if (fetchError) return <p className="text-sm text-danger-500 italic">Không thể tải file PDF.</p>;
    if (!blobUrl) return (
      <div className="flex items-center justify-center gap-2 py-10 text-content-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Đang tải file...
      </div>
    );
    return (
      <iframe
        src={blobUrl}
        title={doc.title}
        className="w-full rounded-lg border border-default"
        style={{ height: 520 }}
      />
    );
  }

  if (IMAGE_TYPES.includes(doc.fileType)) {
    if (fetchError) return <p className="text-sm text-danger-500 italic">Không thể tải ảnh.</p>;
    if (!blobUrl) return (
      <div className="flex items-center justify-center gap-2 py-6 text-content-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Đang tải ảnh...
      </div>
    );
    return (
      <img
        src={blobUrl}
        alt={doc.title}
        className="max-w-full rounded-lg border border-default"
      />
    );
  }

  if (TEXT_TYPES.includes(doc.fileType)) {
    return doc.contentSummary ? (
      <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">
        {doc.contentSummary}
      </p>
    ) : (
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="text-sm text-content-muted italic">Không thể hiển thị inline. Tải xuống để xem.</p>
        <a
          href={apiUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors"
        >
          <Download size={14} /> Tải xuống
        </a>
      </div>
    );
  }

  return <p className="text-sm text-content-muted italic">Chưa có tóm tắt nội dung.</p>;
}

// ─── Version compare ──────────────────────────────────────────────────────────

type DiffRow = {
  left: { text: string; type: 'same' | 'removed' } | null;
  right: { text: string; type: 'same' | 'added' } | null;
};

function computeDiff(oldText: string, newText: string): DiffRow[] {
  const a: string[] = oldText ? oldText.split('\n') : [];
  const b: string[] = newText ? newText.split('\n') : [];
  const m = a.length, n = b.length;

  // Flat 1D array avoids noUncheckedIndexedAccess issues with 2D arrays
  const dp = new Array<number>((m + 1) * (n + 1)).fill(0);
  const g = (r: number, c: number) => dp[r * (n + 1) + c] ?? 0;
  const s = (r: number, c: number, v: number) => { dp[r * (n + 1) + c] = v; };

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      s(i, j, a[i-1] === b[j-1] ? g(i-1, j-1) + 1 : Math.max(g(i-1, j), g(i, j-1)));

  const ops: { op: 'same' | 'del' | 'ins'; text: string }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    const ai = a[i-1] ?? '';
    const bj = b[j-1] ?? '';
    if (i > 0 && j > 0 && ai === bj) {
      ops.unshift({ op: 'same', text: ai }); i--; j--;
    } else if (j > 0 && (i === 0 || g(i, j-1) >= g(i-1, j))) {
      ops.unshift({ op: 'ins', text: bj }); j--;
    } else {
      ops.unshift({ op: 'del', text: ai }); i--;
    }
  }

  return ops.map(op => {
    if (op.op === 'same') return { left: { text: op.text, type: 'same' as const }, right: { text: op.text, type: 'same' as const } };
    if (op.op === 'del')  return { left: { text: op.text, type: 'removed' as const }, right: null };
    return { left: null, right: { text: op.text, type: 'added' as const } };
  });
}

function VersionCompare({ versions }: { versions: DocumentVersion[] }) {
  const [leftId,  setLeftId]  = useState(() => versions[0]?.id ?? '');
  const [rightId, setRightId] = useState(() => versions[1]?.id ?? versions[0]?.id ?? '');

  const leftVer  = versions.find(v => v.id === leftId);
  const rightVer = versions.find(v => v.id === rightId);

  const rows = useMemo(
    () => computeDiff(leftVer?.contentSummary ?? '', rightVer?.contentSummary ?? ''),
    [leftVer?.contentSummary, rightVer?.contentSummary],
  );

  if (versions.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-content-muted">
        <ArrowLeftRight size={40} className="text-content-muted opacity-50" />
        <p className="text-sm">Cần ít nhất 2 phiên bản để so sánh.</p>
      </div>
    );
  }

  const added   = rows.filter(r => r.right?.type === 'added').length;
  const removed = rows.filter(r => r.left?.type  === 'removed').length;

  return (
    <div className="p-6 space-y-4">
      {/* Version selectors */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-content-secondary mb-1">Phiên bản (trái)</label>
          <select
            value={leftId}
            onChange={e => setLeftId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
          >
            {versions.map(v => (
              <option key={v.id} value={v.id}>{v.versionNumber} — {v.createdAt?.slice(0, 10)}</option>
            ))}
          </select>
        </div>
        <ArrowLeftRight size={16} className="text-content-muted mt-5 shrink-0" />
        <div className="flex-1">
          <label className="block text-xs font-medium text-content-secondary mb-1">Phiên bản (phải)</label>
          <select
            value={rightId}
            onChange={e => setRightId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
          >
            {versions.map(v => (
              <option key={v.id} value={v.id}>{v.versionNumber} — {v.createdAt?.slice(0, 10)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      {leftId !== rightId && (
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-danger-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-danger-500 inline-block" />
            {removed} dòng xóa
          </span>
          <span className="flex items-center gap-1 text-success-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
            {added} dòng thêm
          </span>
        </div>
      )}

      {/* Diff view */}
      <div className="rounded-xl border border-default overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-2 divide-x divide-strong bg-subtle border-b border-default">
          <div className="px-4 py-2.5 flex items-center gap-2">
            <StatusBadge status={leftVer?.status ?? 'Draft'} />
            <span className="text-xs font-mono font-semibold text-content-secondary">{leftVer?.versionNumber}</span>
            <span className="text-xs text-content-muted">· {leftVer?.createdAt?.slice(0, 10)}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-2">
            <StatusBadge status={rightVer?.status ?? 'Draft'} />
            <span className="text-xs font-mono font-semibold text-content-secondary">{rightVer?.versionNumber}</span>
            <span className="text-xs text-content-muted">· {rightVer?.createdAt?.slice(0, 10)}</span>
          </div>
        </div>

        {/* Diff rows */}
        {rows.length === 0 ? (
          <div className="grid grid-cols-2 divide-x divide-strong">
            <div className="px-4 py-10 text-center text-sm text-content-muted italic">Chưa có nội dung</div>
            <div className="px-4 py-10 text-center text-sm text-content-muted italic">Chưa có nội dung</div>
          </div>
        ) : (
          <div className="divide-y divide-strong font-mono text-xs">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 divide-x divide-strong min-h-[26px]">
                <div className={`px-4 py-1 whitespace-pre-wrap leading-relaxed break-all ${
                  row.left?.type === 'removed'
                    ? 'bg-danger-50/10 text-danger-700 line-through'
                    : !row.left
                    ? 'bg-subtle'
                    : 'text-content-secondary'
                }`}>
                  {row.left?.text ?? ''}
                </div>
                <div className={`px-4 py-1 whitespace-pre-wrap leading-relaxed break-all ${
                  row.right?.type === 'added'
                    ? 'bg-success-50/10 text-success-700'
                    : !row.right
                    ? 'bg-subtle'
                    : 'text-content-secondary'
                }`}>
                  {row.right?.text ?? ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  doc,
  versions,
  versionsLoading,
  activeTab,
  setActiveTab,
  actionLoading,
  error,
  successMsg,
  onApprove,
  onReturnDraft,
  onRequestRevision,
  onRollback,
  onSubmitReview,
  onArchive,
}: {
  doc: KnowledgeDocument;
  versions: DocumentVersion[];
  versionsLoading: boolean;
  activeTab: DocDetailTab;
  setActiveTab: (t: DocDetailTab) => void;
  actionLoading: boolean;
  error: string;
  successMsg: string;
  onApprove: () => void;
  onReturnDraft: () => void;
  onRequestRevision: () => void;
  onRollback: () => void;
  onSubmitReview: () => void;
  onArchive: () => void;
}) {
  const tabs: { key: DocDetailTab; label: string }[] = [
    { key: 'info', label: 'Thông tin' },
    { key: 'versions', label: 'Version Control' },
    { key: 'compare', label: 'So sánh phiên bản' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Doc header */}
      <div className="px-6 py-4 border-b border-default bg-surface shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-content-primary">{doc.title}</h2>
          <StatusBadge status={doc.status} />
          <span className="text-xs font-mono text-content-secondary px-2 py-0.5 bg-subtle rounded-md">
            {doc.currentVersion}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-content-muted">
          <BookOpen size={11} /> {doc.knowledgeBaseName}
          <span className="text-content-muted">·</span>
          <Clock size={11} /> {doc.versionCount} phiên bản
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-default bg-surface shrink-0 px-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-2 text-sm shrink-0">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="mx-6 mt-3 flex items-center gap-2 bg-success-50/10 border border-success-500/30 text-success-700 rounded-lg px-4 py-2 text-sm shrink-0">
          <Check size={14} className="shrink-0" /> {successMsg}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' && (
          <div className="p-6 space-y-5">
            {/* Approval timeline */}
            <div className="bg-surface rounded-xl border border-default">
              <ApprovalTimeline status={doc.status} />
            </div>

            {/* Content preview */}
            <div className="bg-surface rounded-xl border border-default">
              <div className="flex items-center justify-between px-5 py-3 border-b border-strong">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-primary-500" />
                  <span className="text-sm font-medium text-content-primary">
                    Nội dung phiên bản hiện tại ({doc.currentVersion})
                  </span>
                </div>
                <button
                  onClick={() => {
                    const url = knowledgeDocumentsApi.fileUrl(doc.id);
                    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
                    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                      .then(r => r.blob())
                      .then(b => {
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(b);
                        a.download = doc.title;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
                      })
                      .catch(() => window.open(url, '_blank'));
                  }}
                  className="flex items-center gap-1 text-xs text-content-muted hover:text-primary-600 transition-colors"
                  title="Tải xuống"
                >
                  <Download size={13} />
                </button>
              </div>
              <div className="px-5 py-4">
                <FilePreview doc={doc} />
              </div>
            </div>

            {/* Doc info */}
            <div className="bg-surface rounded-xl border border-default px-5 py-4">
              <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-3">Thông tin tài liệu</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-content-muted">Người tạo:</span>
                  <span className="text-content-primary font-medium">{doc.authorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-muted">Ngày nộp:</span>
                  <span className="text-content-primary">{doc.submittedAt?.slice(0, 10) ?? doc.updatedAt?.slice(0, 10)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-muted">Loại tệp:</span>
                  <span className="text-content-primary">{doc.fileType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-muted">Số phiên bản:</span>
                  <span className="text-content-primary">{doc.versionCount}</span>
                </div>
                <div className="col-span-2 flex justify-between">
                  <span className="text-content-muted">Bộ tri thức:</span>
                  <span className="text-content-primary font-medium text-right max-w-[220px] truncate">{doc.knowledgeBaseName}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <VersionsList versions={versions} loading={versionsLoading} />
        )}

        {activeTab === 'compare' && (
          versionsLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-content-muted text-sm">
              <Loader2 size={16} className="animate-spin" /> Đang tải phiên bản...
            </div>
          ) : (
            <VersionCompare versions={versions} />
          )
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-default bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-muted">Trạng thái hiện tại:</span>
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex items-center gap-2">
          {/* Draft: chỉ nút Gửi duyệt */}
          {doc.status === 'Draft' && (
            <button
              onClick={onSubmitReview}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Gửi duyệt
            </button>
          )}

          {/* Review: các nút kiểm duyệt */}
          {doc.status === 'Review' && (
            <>
              <button
                onClick={onRollback}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle disabled:opacity-40 transition-colors"
              >
                <RotateCcw size={13} /> Rollback
              </button>
              <button
                onClick={onRequestRevision}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-warning-500/30 text-warning-700 rounded-lg hover:bg-warning-50/10 disabled:opacity-40 transition-colors"
              >
                <Edit2 size={13} /> Yêu cầu chỉnh sửa
              </button>
              <button
                onClick={onReturnDraft}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle disabled:opacity-40 transition-colors"
              >
                <X size={13} /> Trả về Draft
              </button>
              <button
                onClick={onApprove}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Phê duyệt & Publish
              </button>
            </>
          )}

          {/* Approved: Rollback + Archive */}
          {doc.status === 'Approved' && (
            <>
              <button
                onClick={onRollback}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle disabled:opacity-40 transition-colors"
              >
                <RotateCcw size={13} /> Rollback
              </button>
              <button
                onClick={onArchive}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle disabled:opacity-40 transition-colors"
              >
                <Archive size={13} /> Archive
              </button>
            </>
          )}

          {/* Archived: chỉ Rollback */}
          {doc.status === 'Archived' && (
            <button
              onClick={onRollback}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle disabled:opacity-40 transition-colors"
            >
              <RotateCcw size={13} /> Rollback
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Request revision modal ───────────────────────────────────────────────────

function RevisionModal({
  note,
  setNote,
  onClose,
  onSubmit,
  loading,
}: {
  note: string;
  setNote: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default bg-surface">
          <h2 className="font-semibold text-content-primary">Yêu cầu chỉnh sửa</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-secondary"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Nội dung yêu cầu chỉnh sửa <span className="text-danger-600">*</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Mô tả chi tiết những gì cần chỉnh sửa..."
              rows={4}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary bg-surface placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
              Hủy
            </button>
            <button
              onClick={onSubmit}
              disabled={loading || !note.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-warning-600 text-white rounded-lg hover:bg-warning-700 disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
              Gửi yêu cầu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function KiemDuyetView() {
  const {
    documents, loading, error, successMsg,
    search, setSearch,
    statusFilter, setStatusFilter,
    counts,
    selectedDoc, handleSelectDoc,
    versions, versionsLoading,
    activeTab, setActiveTab,
    actionLoading,
    showRevisionModal, setShowRevisionModal,
    revisionNote, setRevisionNote,
    handleApprove, handleReturnDraft, handleRequestRevision, handleRollback,
    handleSubmitReview, handleArchive,
  } = useKiemDuyet();

  const STATUS_TABS = [
    { value: '',         label: 'Tất cả', count: counts.all },
    { value: 'Draft',    label: 'Draft',  count: counts.draft },
    { value: 'Review',   label: 'Review', count: counts.review },
    { value: 'Approved', label: 'Approved', count: counts.approved },
  ] as const;

  return (
    <div className="flex flex-col h-full">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 bg-surface border-b border-default shrink-0">
        <span className="text-sm text-content-muted">Tri thức AI</span>
        <ChevronRight size={14} className="text-content-muted" />
        <span className="text-sm font-medium text-content-primary">Kiểm duyệt & Phê duyệt tri thức</span>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <div className="w-72 shrink-0 flex flex-col border-r border-default bg-surface">
          {/* Header */}
          <div className="px-4 py-3 border-b border-default">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-content-primary">Tài liệu tri thức</span>
              <span className="text-xs text-content-muted bg-subtle px-2 py-0.5 rounded-full">
                {counts.all} tài liệu
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2.5 border-b border-strong">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm tài liệu..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content-primary"
              />
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex border-b border-strong px-2 pt-1">
            {STATUS_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value as DocStatus | '')}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-t transition-colors ${
                  statusFilter === t.value
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                {t.label}
                <span className={`px-1 rounded text-xs ${statusFilter === t.value ? 'bg-primary-100 text-primary-700' : 'bg-subtle text-content-muted'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={18} className="animate-spin text-content-muted" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-xs text-content-muted py-10">Không có tài liệu nào.</p>
            ) : (
              documents.map(doc => (
                <DocListItem
                  key={doc.id}
                  doc={doc}
                  active={selectedDoc?.id === doc.id}
                  onClick={() => handleSelectDoc(doc)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-subtle">
          {!selectedDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-content-muted">
              <FileText size={48} className="text-content-muted opacity-50" />
              <p className="text-sm">Chọn tài liệu để xem chi tiết và phê duyệt</p>
            </div>
          ) : (
            <DetailPanel
              doc={selectedDoc}
              versions={versions}
              versionsLoading={versionsLoading}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              actionLoading={actionLoading}
              error={error}
              successMsg={successMsg}
              onApprove={handleApprove}
              onReturnDraft={handleReturnDraft}
              onRequestRevision={() => setShowRevisionModal(true)}
              onRollback={handleRollback}
              onSubmitReview={handleSubmitReview}
              onArchive={handleArchive}
            />
          )}
        </div>

      </div>

      {/* Revision modal */}
      {showRevisionModal && (
        <RevisionModal
          note={revisionNote}
          setNote={setRevisionNote}
          onClose={() => { setShowRevisionModal(false); setRevisionNote(''); }}
          onSubmit={handleRequestRevision}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
