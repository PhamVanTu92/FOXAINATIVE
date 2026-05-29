'use client';

import {
  Search, ChevronLeft, ChevronRight, FileText, AlertCircle,
  Pencil, Trash2, Download, X, Database, Check, Eye,
  ClipboardList, Clock, Loader2, ZoomIn, Table2, Image as ImageIcon,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocListItem, DocDetail } from '@/lib/ocr-api';
import { useDocumentList } from '../hooks/useDocumentList';
import { useDocumentDetail } from '../hooks/useDocumentDetail';
import { useRoutePermission } from '@/hooks/usePermission';
import { STATUS_CONFIG_FULL, TYPE_CONFIG, STANDARD_FIELD_KEYS, fmtDate, fmtNum } from '../constants';

function getFileIconDetail(mimeType: string | null | undefined, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType?.startsWith('image/') || ['png','jpg','jpeg','gif','webp','tiff','tif'].includes(ext))
    return { Icon: ImageIcon, color: 'text-violet-400' };
  if (mimeType?.includes('spreadsheetml') || mimeType?.includes('ms-excel') || ['xlsx','xls','csv'].includes(ext))
    return { Icon: Table2, color: 'text-success-400' };
  if (mimeType?.includes('wordprocessingml') || ext === 'docx')
    return { Icon: FileText, color: 'text-primary-400' };
  return { Icon: FileText, color: 'text-danger-400' };
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG_FULL[status as keyof typeof STATUS_CONFIG_FULL]
    ?? { label: status, cls: 'bg-subtle text-content-secondary border-default' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_CONFIG[type] ?? { label: type, cls: 'bg-subtle text-content-muted border-default' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${t.cls}`}>
      {t.label}
    </span>
  );
}

function StatCard({
  label, value, colorClass, accentCls = 'border-default', onClick,
}: { label: string; value: number; colorClass: string; accentCls?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-xl border-l-4 border border-default shadow-sm px-5 py-4 transition-shadow hover:shadow-md ${accentCls} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <p className="text-xs font-medium text-content-muted uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1.5 tabular-nums ${colorClass}`}>{value.toLocaleString('vi-VN')}</p>
    </div>
  );
}

function DetailDrawer({
  detail, list,
}: {
  detail: ReturnType<typeof useDocumentDetail>;
  list: ReturnType<typeof useDocumentList>;
}) {
  const { detailOpen, setDetailOpen, detailDoc, detailLoading, activeFileIdx, setActiveFileIdx, panelWidth, isDragging, handleDividerMouseDown } = detail;

  if (!detailOpen) return null;

  const allFiles = detailDoc ? [
    { url: ocrApi.getDocumentFileUrl(detailDoc.id), fileName: detailDoc.fileName, mimeType: detailDoc.mimeType, isPrimary: true },
    ...(detailDoc.extraFileUrls ?? []).map((f, i) => ({
      url: `${ocrApi.getDocumentFileUrl(detailDoc.id)}?extra=${i}`,
      fileName: f.fileName ?? `Tệp ${i + 2}`,
      mimeType: f.mimeType,
      isPrimary: false,
    })),
  ] : [];
  const activeFile = allFiles[activeFileIdx] ?? allFiles[0];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className={`flex-1 bg-neutral-900 flex flex-col overflow-hidden${isDragging ? ' pointer-events-none' : ''}`}>
        {allFiles.length > 1 && (
          <div className="flex items-center gap-0.5 px-2 py-1.5 bg-neutral-800 border-b border-neutral-700 overflow-x-auto shrink-0">
            {allFiles.map((f, idx) => {
              const { Icon: FI, color: fc } = getFileIconDetail(f.mimeType, f.fileName ?? '');
              return (
                <button
                  key={idx}
                  onClick={() => setActiveFileIdx(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs whitespace-nowrap transition-colors shrink-0 ${
                    activeFileIdx === idx ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                  }`}
                >
                  <FI className={`w-3 h-3 ${fc}`} />
                  {f.fileName ?? `Tệp ${idx + 1}`}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-800 shrink-0">
          <span className="text-xs text-neutral-300 truncate max-w-xs">
            {activeFile?.fileName ?? 'Chứng từ gốc'}
          </span>
          {activeFile?.mimeType && (
            <a
              href={activeFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-700 hover:bg-neutral-600 px-2.5 py-1 rounded-md transition-colors shrink-0 ml-3"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              Mở rộng
            </a>
          )}
        </div>
        <div className="flex-1 overflow-hidden relative">
          {detailLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
            </div>
          ) : activeFile?.mimeType?.startsWith('image/') ? (
            <div className="h-full overflow-auto flex items-start justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeFile.url} alt={activeFile.fileName ?? 'document'} className="max-w-full object-contain rounded shadow-lg" />
            </div>
          ) : activeFile?.mimeType === 'application/pdf' ? (
            <iframe src={activeFile.url} className="w-full h-full border-0" title={activeFile.fileName ?? 'document'} />
          ) : activeFile ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-500">
              {(activeFile.mimeType?.includes('spreadsheetml') || activeFile.mimeType?.includes('ms-excel') || activeFile.mimeType === 'text/csv')
                ? <Table2 className="w-12 h-12 text-success-400" />
                : activeFile.mimeType?.includes('wordprocessingml')
                ? <FileText className="w-12 h-12 text-primary-400" />
                : <ImageIcon className="w-12 h-12 text-neutral-600" />
              }
              <p className="text-sm text-center px-6">
                {(activeFile.mimeType?.includes('spreadsheetml') || activeFile.mimeType?.includes('ms-excel') || activeFile.mimeType === 'text/csv')
                  ? 'File Excel/CSV — AI đã đọc nội dung bảng tính'
                  : activeFile.mimeType?.includes('wordprocessingml')
                  ? 'File Word — AI đã đọc nội dung văn bản'
                  : 'Không thể xem trước định dạng này'}
              </p>
              <a href={activeFile.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary-400 hover:text-primary-300 underline flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Tải file xuống
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-neutral-500">Chọn chứng từ để xem</p>
            </div>
          )}
        </div>
      </div>
      <div
        onMouseDown={handleDividerMouseDown}
        className="w-1 shrink-0 bg-neutral-700 hover:bg-primary-400 active:bg-primary-500 cursor-col-resize transition-colors relative"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div className="shrink-0 bg-surface shadow-2xl flex flex-col overflow-hidden" style={{ width: panelWidth }}>
        <div className="px-6 py-4 border-b border-default flex items-start justify-between shrink-0 bg-surface">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-content-primary truncate">
                {detailDoc?.fileName ?? 'Chi tiết chứng từ'}
              </h2>
              {detailDoc && <StatusBadge status={detailDoc.status} />}
            </div>
            {detailDoc && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-content-muted">{detailDoc.schema.name}</span>
                <TypeBadge type={detailDoc.schema.type} />
              </div>
            )}
          </div>
          <button
            onClick={() => setDetailOpen(false)}
            className="p-1.5 rounded-lg text-content-muted hover:text-content-secondary hover:bg-subtle shrink-0 ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-subtle">
          {detailLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detailDoc ? (
            <DetailPanelBody doc={detailDoc} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailPanelBody({ doc }: { doc: DocDetail }) {
  return (
    <div className="p-6 space-y-5">
      {doc.ocrConfidence != null && (
        <div className="bg-surface border border-default rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-content-muted shrink-0">Độ tin cậy OCR</span>
          <div className="flex-1 bg-strong rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${doc.ocrConfidence > 0.85 ? 'bg-success-500' : doc.ocrConfidence > 0.6 ? 'bg-amber-400' : 'bg-danger-400'}`}
              style={{ width: `${Math.round(doc.ocrConfidence * 100)}%` }}
            />
          </div>
          <span className={`text-sm font-bold shrink-0 ${doc.ocrConfidence > 0.85 ? 'text-success-600' : doc.ocrConfidence > 0.6 ? 'text-amber-600' : 'text-danger-600'}`}>
            {Math.round(doc.ocrConfidence * 100)}%
          </span>
        </div>
      )}
      {doc.status === 'ERROR' && doc.ocrError && (
        <div className="flex items-start gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{doc.ocrError}</span>
        </div>
      )}
      {doc.values.length > 0 && (
        <div className="bg-surface border border-default rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-default bg-primary-50/10 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-primary-800">Trường dữ liệu</h3>
            <span className="text-xs text-primary-600 bg-primary-500/20 px-2 py-0.5 rounded-full">
              {doc.values.length} trường
            </span>
          </div>
          <div className="divide-y divide-strong">
            {doc.values.map(v => (
              <div key={v.fieldId} className="flex items-center px-4 py-2.5 gap-3">
                <span className="text-xs text-content-muted w-36 shrink-0">{v.field.label}</span>
                <span className={`text-sm flex-1 truncate ${v.stringValue ? 'text-content-primary' : 'text-content-muted italic'}${v.field.dataType === 'CURRENCY' && v.stringValue ? ' font-mono' : ''}`}>
                  {v.field.dataType === 'CURRENCY' && v.stringValue ? fmtNum(v.stringValue) : (v.stringValue || '—')}
                </span>
                {v.confidence != null && v.stringValue && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${v.confidence > 0.85 ? 'text-success-600 bg-success-50/20' : v.confidence > 0.6 ? 'text-amber-600 bg-amber-50/20' : 'text-danger-600 bg-danger-50/20'}`}>
                    {Math.round(v.confidence * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {doc.schema.tables.length > 0 && doc.schema.tables.map(table => {
        const items = doc.lineItems.filter(li => !li.tableKey || li.tableKey === table.tableKey);
        if (items.length === 0) return null;
        const useSchemaColumns = table.columns.length > 0;
        return (
          <div key={table.id} className="bg-surface border border-default rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-default bg-orange-50/10 flex items-center gap-2">
              <Table2 className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-orange-800">{table.name}</h3>
              <span className="text-xs text-orange-600 bg-orange-500/20 px-2 py-0.5 rounded-full">{items.length} dòng</span>
            </div>
            {!useSchemaColumns ? (
              <p className="px-4 py-3 text-sm text-content-muted">Bảng chưa được cấu hình cột.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-default text-xs text-content-muted uppercase tracking-wide">
                      <th className="px-3 py-2.5 text-center w-10">STT</th>
                      {table.columns.map(col => (
                        <th key={col.id} className={`px-3 py-2.5 ${col.dataType === 'NUMBER' || col.dataType === 'CURRENCY' ? 'text-right' : 'text-left'}`}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((li, i) => (
                      <tr key={li.stt} className={`border-b border-default last:border-0 ${i % 2 === 1 ? 'bg-strong/30' : ''}`}>
                        <td className="px-3 py-2.5 text-center text-content-muted text-xs">{li.stt}</td>
                        {table.columns.map(col => {
                          const isNum = col.dataType === 'NUMBER' || col.dataType === 'CURRENCY';
                          const raw = STANDARD_FIELD_KEYS.has(col.columnKey)
                            ? li[col.columnKey as keyof typeof li]
                            : li.extraData?.[col.columnKey];
                          return (
                            <td key={col.columnKey} className={`px-3 py-2.5 text-content-primary text-xs${isNum ? ' text-right font-mono' : ''}`}>
                              {isNum ? fmtNum(raw as number | null | undefined) : String(raw ?? '—')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {doc.auditLogs.length > 0 && (
        <div className="bg-surface border border-default rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-default flex items-center gap-2">
            <Clock className="w-4 h-4 text-content-muted" />
            <h3 className="text-sm font-semibold text-content-primary">Lịch sử thay đổi</h3>
          </div>
          <div className="divide-y divide-strong">
            {doc.auditLogs.slice(0, 15).map((log, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span className="text-xs text-content-muted shrink-0 whitespace-nowrap mt-0.5 w-20">
                  {fmtDate(log.changedAt)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-content-secondary">{log.changedBy}</span>
                    {log.oldStatus && log.newStatus && (
                      <div className="flex items-center gap-1">
                        <StatusBadge status={log.oldStatus} />
                        <span className="text-content-muted text-xs">→</span>
                        <StatusBadge status={log.newStatus} />
                      </div>
                    )}
                  </div>
                  {log.note && (
                    <p className="text-xs text-content-muted mt-0.5 italic truncate">{log.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChungTuView() {
  const list   = useDocumentList();
  const detail = useDocumentDetail(list.showToast);

  const {
    stats, docs, loading, pageError, selectedIds,
    search, setSearch, statusFilter, setStatusFilter, typeFilter, setTypeFilter,
    dateFrom, setDateFrom, dateTo, setDateTo, exporting, page, setPage,
    editDoc, setEditDoc, editStatus, setEditStatus, editSaving,
    transferOpen, setTransferOpen, transferIds, transferring, loadingTransfer,
    confirmDialog, setConfirmDialog, toast, setToast, showToast,
    handleBulkConfirm, handleBulkDelete, openTransferModal, openTransferAllConfirmed,
    handleTransfer, deleteDoc, openEditModal, handleSaveEdit, handleExportExcel,
    toggleSelect, toggleAll,
  } = list;

  const { openDetailPanel } = detail;

  const canUpdate = useRoutePermission('UPDATE');
  const canDelete = useRoutePermission('DELETE');
  const canExport = useRoutePermission('EXPORT');

  return (
    <div className="min-h-full bg-subtle">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-default shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Quản lý Chứng từ</h1>
            <p className="text-sm text-content-muted mt-0.5">Danh sách tất cả chứng từ đã xử lý OCR</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-2 border border-default bg-surface text-content-secondary px-4 py-2 rounded-lg text-sm font-medium hover:bg-subtle disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Đang xuất...' : (selectedIds.size > 0 ? `Xuất Excel (${selectedIds.size})` : 'Xuất Excel')}
            </button>
          )}
          {(() => {
            const confirmedCount = selectedIds.size > 0
              ? [...selectedIds].filter(id => docs?.items.find(d => d.id === id)?.status === 'CONFIRMED').length
              : (stats?.confirmed ?? 0);
            const isDisabled = loadingTransfer || confirmedCount === 0;
            return (
              <button
                onClick={() => selectedIds.size > 0 ? openTransferModal([...selectedIds]) : openTransferAllConfirmed()}
                disabled={isDisabled}
                title={confirmedCount === 0 ? 'Không có chứng từ "Đã xác nhận" nào để chuyển' : undefined}
                className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Database className="w-4 h-4" />
                {loadingTransfer ? 'Đang tải...' : (
                  <>Chuyển vào kho tri thức{confirmedCount > 0 && <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded text-xs">{confirmedCount}</span>}</>
                )}
              </button>
            );
          })()}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="Tổng chứng từ"  value={stats.total}       colorClass="text-content-primary"    accentCls="border-l-default"    onClick={() => { setStatusFilter(''); setPage(1); }} />
            <StatCard label="Chờ xác nhận"   value={stats.processed}   colorClass="text-orange-500"  accentCls="border-l-orange-400"  onClick={() => { setStatusFilter('PROCESSED'); setPage(1); }} />
            <StatCard label="Đã xác nhận"    value={stats.confirmed}   colorClass="text-emerald-600" accentCls="border-l-emerald-400" onClick={() => { setStatusFilter('CONFIRMED'); setPage(1); }} />
            <StatCard label="Đã chuyển kho"  value={stats.transferred} colorClass="text-violet-600"  accentCls="border-l-violet-400"  onClick={() => { setStatusFilter('TRANSFERRED'); setPage(1); }} />
            <StatCard label="Lỗi OCR"        value={stats.error}       colorClass="text-rose-500"  accentCls="border-l-rose-400"  onClick={() => { setStatusFilter('ERROR'); setPage(1); }} />
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-surface rounded-xl border border-default shadow-sm px-4 py-3 flex flex-wrap gap-2.5 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Tìm theo số HĐ, tên file, người bán..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-subtle focus:bg-surface text-content-primary placeholder:text-content-muted transition-colors"
              />
            </div>
          </div>
          <div className="w-px h-6 bg-strong shrink-0" />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Đang xử lý</option>
            <option value="PROCESSED">Nháp</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="TRANSFERRED">Đã chuyển kho</option>
            <option value="ERROR">Lỗi</option>
          </select>
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <div className="flex items-center h-9 border border-default rounded-lg overflow-hidden bg-surface shrink-0 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-400">
            <span className="pl-2.5 pr-1.5 text-[11px] font-medium text-content-muted whitespace-nowrap select-none">Từ ngày</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="h-full text-sm bg-transparent border-0 focus:outline-none w-[128px] text-content-primary"
            />
            <span className="px-1.5 text-content-muted select-none text-sm">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="h-full text-sm bg-transparent border-0 focus:outline-none w-[128px] pr-2 text-content-primary"
            />
          </div>
          {(search || statusFilter || typeFilter || dateFrom || dateTo) && (
            <>
              <div className="w-px h-6 bg-strong shrink-0" />
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                className="h-9 px-3 text-sm text-content-muted hover:text-danger-600 border border-default rounded-lg hover:bg-danger-50/10 hover:border-danger-500/30 transition-colors flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Xóa bộ lọc
              </button>
            </>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="bg-primary-50/10 border border-primary-500/30 rounded-xl shadow-sm px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-primary-700">Đã chọn {selectedIds.size} chứng từ</span>
            {canUpdate && (
              <button onClick={handleBulkConfirm} className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-500 font-medium">
                <Check className="w-4 h-4" /> Xác nhận hàng loạt
              </button>
            )}
            {canUpdate && (
              <button onClick={() => openTransferModal([...selectedIds])} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-500 font-medium">
                <Database className="w-4 h-4" /> Chuyển vào kho tri thức
              </button>
            )}
            {canDelete && (
              <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-sm text-danger-600 hover:text-danger-500 font-medium">
                <Trash2 className="w-4 h-4" /> Xóa hàng loạt
              </button>
            )}
            <button onClick={() => list.setSelectedIds(new Set())} className="ml-auto flex items-center gap-1 text-sm text-content-muted hover:text-content-secondary">
              <X className="w-3.5 h-3.5" /> Bỏ chọn
            </button>
          </div>
        )}

        {pageError && (
          <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {pageError}
          </div>
        )}

        {/* Table */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-default bg-subtle text-xs font-semibold text-content-muted uppercase tracking-wide">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!docs?.items.length && selectedIds.size === docs.items.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left w-12">STT</th>
                  <th className="px-4 py-3 text-left">Mã chứng từ</th>
                  <th className="px-4 py-3 text-left">Tên chứng từ</th>
                  <th className="px-4 py-3 text-left">Loại</th>
                  <th className="px-4 py-3 text-left">Ngày OCR</th>
                  <th className="px-4 py-3 text-left">Người thực hiện</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-strong">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-content-muted">Đang tải...</td>
                  </tr>
                ) : !docs?.items.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center">
                      <FileText className="w-10 h-10 text-content-muted mx-auto mb-2 opacity-50" />
                      <p className="text-content-muted text-sm">Không có chứng từ nào</p>
                    </td>
                  </tr>
                ) : docs.items.map((doc: DocListItem, idx: number) => (
                  <tr
                    key={doc.id}
                    className={`transition-colors hover:bg-subtle ${selectedIds.has(doc.id) ? 'bg-primary-50/10' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}>
                      <input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => {}} className="rounded" />
                    </td>
                    <td className="px-4 py-3 text-content-muted text-xs">{(page - 1) * 25 + idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-content-primary">{doc.schemaCode}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <button
                        onClick={() => openDetailPanel(doc.id)}
                        className="flex items-start gap-2 hover:text-primary-600 transition-colors text-left w-full"
                      >
                        <FileText className="w-3.5 h-3.5 text-content-muted shrink-0 mt-0.5" />
                        <span className="flex flex-col min-w-0">
                          <span className="truncate text-sm font-medium text-content-primary">{doc.schema.name}</span>
                          {doc.fileName && <span className="truncate text-xs text-content-muted">{doc.fileName}</span>}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={doc.schema.type} /></td>
                    <td className="px-4 py-3 text-content-muted text-xs whitespace-nowrap">{fmtDate(doc.createdAt)}</td>
                    <td className="px-4 py-3 text-content-muted text-xs">—</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openDetailPanel(doc.id)} className="p-1.5 text-content-muted hover:text-violet-500 hover:bg-violet-500/10 rounded-lg transition-colors" title="Xem chi tiết">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canUpdate && (
                          <button onClick={() => openEditModal(doc)} className="p-1.5 text-content-muted hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors" title="Sửa chứng từ">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => deleteDoc(doc.id)} className="p-1.5 text-content-muted hover:text-danger-500 hover:bg-danger-500/10 rounded-lg transition-colors" title="Xóa chứng từ">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {docs && docs.total > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-content-muted">
              Hiển thị <span className="font-medium text-content-primary">{(docs.page - 1) * 25 + 1}–{Math.min(docs.page * 25, docs.total)}</span> trong tổng số <span className="font-medium text-content-primary">{docs.total.toLocaleString('vi-VN')}</span> chứng từ
            </span>
            {docs.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={docs.page === 1} className="p-1.5 rounded-lg border border-default disabled:opacity-30 hover:bg-subtle transition-colors">
                  <ChevronLeft className="w-4 h-4 text-content-secondary" />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-content-primary bg-surface border border-default rounded-lg min-w-[72px] text-center">
                  {docs.page} / {docs.totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(docs.totalPages, p + 1))} disabled={docs.page === docs.totalPages} className="p-1.5 rounded-lg border border-default disabled:opacity-30 hover:bg-subtle transition-colors">
                  <ChevronRight className="w-4 h-4 text-content-secondary" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editDoc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md border border-default">
            <div className="flex items-center justify-between px-6 py-4 border-b border-default">
              <h2 className="text-base font-semibold text-content-primary">Sửa chứng từ OCR</h2>
              <button onClick={() => setEditDoc(null)} className="p-1.5 rounded-lg text-content-muted hover:text-content-secondary hover:bg-subtle">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">Mã chứng từ</label>
                <input type="text" readOnly value={editDoc.schemaCode} className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-subtle text-content-muted cursor-not-allowed font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">Tên chứng từ</label>
                <input type="text" readOnly value={editDoc.schema.name} className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-subtle text-content-muted cursor-not-allowed" />
              </div>
              {editDoc.fileName && (
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1.5">Tên file</label>
                  <input type="text" readOnly value={editDoc.fileName} className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-subtle text-content-muted cursor-not-allowed" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">Loại chứng từ</label>
                <input type="text" readOnly value={TYPE_CONFIG[editDoc.schema.type]?.label ?? editDoc.schema.type} className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-subtle text-content-muted cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">Trạng thái</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  disabled={editDoc.status === 'CONFIRMED' || editDoc.status === 'TRANSFERRED'}
                  className={`w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${editDoc.status === 'CONFIRMED' || editDoc.status === 'TRANSFERRED' ? 'bg-subtle text-content-muted cursor-not-allowed' : 'bg-surface text-content-primary'}`}
                >
                  <option value="PROCESSED">Nháp</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                  {editDoc.status === 'TRANSFERRED' && <option value="TRANSFERRED">Đã chuyển kho</option>}
                </select>
                {(editDoc.status === 'CONFIRMED' || editDoc.status === 'TRANSFERRED') && (
                  <p className="text-xs text-content-muted mt-1">
                    {editDoc.status === 'TRANSFERRED' ? 'Chứng từ đã chuyển kho không thể thay đổi trạng thái.' : 'Xác nhận rồi → không thể chỉnh sửa trạng thái.'}
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-default flex justify-end gap-3">
              <button onClick={() => setEditDoc(null)} className="px-4 py-2 text-sm text-content-secondary border border-default rounded-lg hover:bg-subtle">Hủy</button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {editSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <DetailDrawer detail={detail} list={list} />

      {/* Transfer modal */}
      {transferOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-default rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${transferIds.length > 0 ? 'bg-teal-500/20' : 'bg-orange-500/20'}`}>
                <Database className={`w-6 h-6 ${transferIds.length > 0 ? 'text-teal-500' : 'text-orange-400'}`} />
              </div>
              <h2 className="text-base font-semibold text-content-primary mb-2">Chuyển vào kho tri thức</h2>
              {transferIds.length > 0 ? (
                <p className="text-sm text-content-muted">
                  Chuyển <span className="font-semibold text-content-primary">{transferIds.length}</span> chứng từ <span className="text-emerald-500 font-medium">đã xác nhận</span> vào kho tri thức?
                </p>
              ) : (
                <p className="text-sm text-content-muted">
                  Không có chứng từ nào ở trạng thái <span className="font-medium text-emerald-500">"Đã xác nhận"</span> trong lựa chọn hiện tại.
                  <br />
                  <span className="text-xs text-content-muted mt-1 block opacity-80">Vui lòng xác nhận chứng từ trước khi chuyển kho.</span>
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-default flex justify-center gap-3">
              <button onClick={() => setTransferOpen(false)} disabled={transferring} className="px-6 py-2 text-sm text-content-secondary border border-default rounded-lg hover:bg-subtle disabled:opacity-50">
                {transferIds.length > 0 ? 'Hủy' : 'Đóng'}
              </button>
              {transferIds.length > 0 && (
                <button onClick={handleTransfer} disabled={transferring} className="px-6 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {transferring ? 'Đang chuyển...' : 'Chuyển'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface border border-default rounded-xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold text-content-primary mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-content-muted leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-default flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-sm text-content-secondary border border-default rounded-lg hover:bg-subtle transition-colors">Hủy</button>
              <button
                onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  confirmDialog.confirmCls === 'bg-danger-600 text-white hover:bg-danger-700' ? 'bg-danger-600 text-white hover:bg-danger-700' :
                  confirmDialog.confirmCls === 'bg-success-600 text-white hover:bg-success-700' ? 'bg-success-600 text-white hover:bg-success-700' :
                  confirmDialog.confirmCls
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-lg border max-w-sm text-sm font-medium animate-in slide-in-from-bottom-2 duration-200 ${
          toast.type === 'error'
            ? 'bg-surface text-danger-600 border-danger-500/30'
            : 'bg-surface text-success-600 border-success-500/30'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'error' ? 'bg-danger-50/10' : 'bg-success-50/10'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-danger-500" /> : <Check className="w-4 h-4 text-success-500" />}
          </div>
          <span className="flex-1 leading-snug text-content-primary">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 text-content-muted hover:text-content-secondary shrink-0 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
