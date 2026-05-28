'use client';

import React from 'react';
import {
  Search, FileText, Loader2, AlertCircle, Check, ChevronRight,
  Clock, Eye, Archive, RotateCcw, Edit2, X, BookOpen,
  CheckCircle2, Circle, ArrowRight,
} from 'lucide-react';
import { useKiemDuyet } from '../hooks/useKiemDuyet';
import type { KnowledgeDocument, DocStatus, DocumentVersion } from '@/lib/knowledge-api';
import type { DocDetailTab } from '../hooks/useKiemDuyet';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<DocStatus, { label: string; color: string; dot: string; Icon: React.ElementType }> = {
  Draft:    { label: 'Draft',    color: 'bg-dark-100 text-dark-500 border border-dark-200',         dot: 'bg-dark-400',    Icon: Edit2 },
  Review:   { label: 'Review',   color: 'bg-warning-100 text-warning-700 border border-warning-200', dot: 'bg-warning-500', Icon: Eye },
  Approved: { label: 'Approved', color: 'bg-success-100 text-success-700 border border-success-200', dot: 'bg-success-500', Icon: CheckCircle2 },
  Archived: { label: 'Archived', color: 'bg-dark-100 text-dark-400 border border-dark-200',          dot: 'bg-dark-300',    Icon: Archive },
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
                  ? 'bg-dark-200 border-dark-300 text-dark-500'
                  : 'bg-white border-dark-200 text-dark-300'
              }`}>
                {isActive ? <cfg.Icon size={18} /> : isDone ? <Check size={16} /> : <Circle size={16} />}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-primary-700' : isDone ? 'text-dark-500' : 'text-dark-300'}`}>
                {cfg.label}
              </span>
            </div>
            {idx < TIMELINE_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 ${idx < currentIdx ? 'bg-dark-300' : 'bg-dark-100'}`} />
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
      className={`w-full text-left px-4 py-3 border-b border-dark-100 transition-colors ${
        active ? 'bg-primary-50 border-r-2 border-r-primary-500' : 'hover:bg-dark-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium leading-snug line-clamp-2 ${active ? 'text-primary-700' : 'text-dark-800'}`}>
          {doc.title}
        </p>
        <StatusBadge status={doc.status} />
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-dark-400 flex-wrap">
        <span className="font-mono text-dark-500">{doc.currentVersion}</span>
        <span className="text-dark-200">·</span>
        <span className="truncate max-w-[120px]">{doc.knowledgeBaseName}</span>
        <span className="text-dark-200">·</span>
        <span>{doc.authorName}</span>
        <span className="text-dark-200">·</span>
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
      <div className="flex items-center justify-center py-12 gap-2 text-dark-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Đang tải...
      </div>
    );
  }
  if (versions.length === 0) {
    return <p className="text-center text-sm text-dark-400 py-12">Chưa có lịch sử phiên bản.</p>;
  }
  return (
    <div className="divide-y divide-dark-100">
      {versions.map((v, idx) => (
        <div key={v.id} className="px-6 py-4 flex items-start gap-4">
          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-primary-600' : 'bg-dark-300'}`}>
              {v.version}
            </div>
            {idx < versions.length - 1 && <div className="w-0.5 h-6 bg-dark-100" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-dark-700">{v.changeNote || 'Không có ghi chú'}</p>
            <p className="text-xs text-dark-400 mt-1">{v.authorName} · {v.createdAt?.slice(0, 10)}</p>
          </div>
        </div>
      ))}
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
}) {
  const tabs: { key: DocDetailTab; label: string }[] = [
    { key: 'info', label: 'Thông tin' },
    { key: 'versions', label: 'Version Control' },
    { key: 'compare', label: 'So sánh phiên bản' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Doc header */}
      <div className="px-6 py-4 border-b border-dark-200 bg-white shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-dark-800">{doc.title}</h2>
          <StatusBadge status={doc.status} />
          <span className="text-xs font-mono text-dark-500 px-2 py-0.5 bg-dark-100 rounded-md">
            {doc.currentVersion}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-dark-400">
          <BookOpen size={11} /> {doc.knowledgeBaseName}
          <span className="text-dark-200">·</span>
          <Clock size={11} /> {doc.versionCount} phiên bản
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-200 bg-white shrink-0 px-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-dark-500 hover:text-dark-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-4 py-2 text-sm shrink-0">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="mx-6 mt-3 flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 rounded-lg px-4 py-2 text-sm shrink-0">
          <Check size={14} className="shrink-0" /> {successMsg}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' && (
          <div className="p-6 space-y-5">
            {/* Approval timeline */}
            <div className="bg-white rounded-xl border border-dark-200">
              <ApprovalTimeline status={doc.status} />
            </div>

            {/* Content preview */}
            <div className="bg-white rounded-xl border border-dark-200">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-dark-100">
                <FileText size={14} className="text-primary-500" />
                <span className="text-sm font-medium text-dark-700">
                  Nội dung phiên bản hiện tại ({doc.currentVersion})
                </span>
              </div>
              <div className="px-5 py-4">
                {doc.contentSummary ? (
                  <p className="text-sm text-dark-600 whitespace-pre-wrap leading-relaxed">{doc.contentSummary}</p>
                ) : (
                  <p className="text-sm text-dark-400 italic">Chưa có tóm tắt nội dung.</p>
                )}
              </div>
            </div>

            {/* Doc info */}
            <div className="bg-white rounded-xl border border-dark-200 px-5 py-4">
              <p className="text-xs font-semibold text-dark-500 uppercase tracking-wide mb-3">Thông tin tài liệu</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-400">Người tạo:</span>
                  <span className="text-dark-700 font-medium">{doc.authorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Ngày nộp:</span>
                  <span className="text-dark-700">{doc.submittedAt?.slice(0, 10) ?? doc.updatedAt?.slice(0, 10)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Loại tệp:</span>
                  <span className="text-dark-700">{doc.fileType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Số phiên bản:</span>
                  <span className="text-dark-700">{doc.versionCount}</span>
                </div>
                <div className="col-span-2 flex justify-between">
                  <span className="text-dark-400">Bộ tri thức:</span>
                  <span className="text-dark-700 font-medium text-right max-w-[220px] truncate">{doc.knowledgeBaseName}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <VersionsList versions={versions} loading={versionsLoading} />
        )}

        {activeTab === 'compare' && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-400">
            <ArrowRight size={40} className="text-dark-200" />
            <p className="text-sm">Chức năng so sánh phiên bản đang phát triển.</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-dark-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Trạng thái hiện tại:</span>
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRollback}
            disabled={actionLoading || doc.versionCount <= 1}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 disabled:opacity-40 transition-colors"
          >
            <RotateCcw size={13} /> Rollback
          </button>
          <button
            onClick={onRequestRevision}
            disabled={actionLoading || doc.status !== 'Review'}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-warning-200 text-warning-700 rounded-lg hover:bg-warning-50 disabled:opacity-40 transition-colors"
          >
            <Edit2 size={13} /> Yêu cầu chỉnh sửa
          </button>
          <button
            onClick={onReturnDraft}
            disabled={actionLoading || doc.status !== 'Review'}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 disabled:opacity-40 transition-colors"
          >
            <X size={13} /> Trả về Draft
          </button>
          <button
            onClick={onApprove}
            disabled={actionLoading || doc.status !== 'Review'}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
          >
            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Phê duyệt & Publish
          </button>
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
          <h2 className="font-semibold text-dark-800">Yêu cầu chỉnh sửa</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Nội dung yêu cầu chỉnh sửa <span className="text-danger-600">*</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Mô tả chi tiết những gì cần chỉnh sửa..."
              rows={4}
              className="w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
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
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-dark-200 shrink-0">
        <span className="text-sm text-dark-400">Tri thức AI</span>
        <ChevronRight size={14} className="text-dark-300" />
        <span className="text-sm font-medium text-dark-700">Kiểm duyệt & Phê duyệt tri thức</span>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <div className="w-72 shrink-0 flex flex-col border-r border-dark-200 bg-white">
          {/* Header */}
          <div className="px-4 py-3 border-b border-dark-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-dark-800">Tài liệu tri thức</span>
              <span className="text-xs text-dark-400 bg-dark-100 px-2 py-0.5 rounded-full">
                {counts.all} tài liệu
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2.5 border-b border-dark-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm tài liệu..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex border-b border-dark-100 px-2 pt-1">
            {STATUS_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value as DocStatus | '')}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-t transition-colors ${
                  statusFilter === t.value
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-dark-500 hover:text-dark-700'
                }`}
              >
                {t.label}
                <span className={`px-1 rounded text-xs ${statusFilter === t.value ? 'bg-primary-100 text-primary-700' : 'bg-dark-100 text-dark-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={18} className="animate-spin text-dark-300" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-xs text-dark-400 py-10">Không có tài liệu nào.</p>
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-dark-50">
          {!selectedDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dark-400">
              <FileText size={48} className="text-dark-200" />
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
