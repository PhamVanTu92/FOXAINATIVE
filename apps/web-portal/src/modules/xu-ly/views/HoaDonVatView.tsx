'use client';

import {
  Upload, Search, RefreshCw, CheckCircle, Trash2, X,
  ChevronLeft, ChevronRight, FileText, Plus, Minus,
  AlertCircle, Check, Save, Clock,
} from 'lucide-react';
import type { LineItem } from '@/lib/ocr-api';
import { useInvoiceList } from '../hooks/useInvoiceList';

const STATUS_CONFIG = {
  DRAFT:     { label: 'Nháp',        cls: 'bg-subtle        text-content-secondary border-default' },
  PROCESSED: { label: 'Đã xử lý',    cls: 'bg-primary-50/10 text-primary-600       border-primary-500/30' },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'bg-success-50/10 text-success-600       border-success-500/30' },
  ERROR:     { label: 'Lỗi',         cls: 'bg-danger-50/10  text-danger-600        border-danger-500/30'  },
} as const;

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    ?? { label: status, cls: 'bg-subtle text-content-muted border-default' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
}

function fmtDateTime(d: string) {
  try { return new Date(d).toLocaleString('vi-VN'); } catch { return d; }
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Tạo mới', EDIT_FIELD: 'Sửa trường', STATUS_CHANGE: 'Thay đổi trạng thái', DELETE: 'Xóa',
};

function StatCard({ label, value, colorClass, borderCls = 'border-l-default' }: { label: string; value: number; colorClass: string; borderCls?: string }) {
  return (
    <div className={`bg-surface rounded-lg border-l-4 border border-default shadow-sm px-4 py-3 hover:shadow-md transition-shadow ${borderCls}`}>
      <p className="text-xs font-medium text-content-muted uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${colorClass}`}>{value.toLocaleString('vi-VN')}</p>
    </div>
  );
}

export function HoaDonVatView() {
  const inv = useInvoiceList();

  const {
    stats, docs, schemas, loading, pageError,
    selectedDoc, setSelectedDoc, detailLoading, selectedIds,
    uploadOpen, setUploadOpen, activeTab, setActiveTab,
    search, setSearch, statusFilter, setStatusFilter,
    dateFrom, setDateFrom, dateTo, setDateTo, page, setPage,
    uploadFile, setUploadFile, uploadSchemaId, setUploadSchemaId,
    uploadLanguage, setUploadLanguage, uploadLoading, uploadMsg, fileInputRef,
    editValues, setEditValues, editLineItems, editDirty, saveLoading, confirmLoading,
    loadStats, loadDocs, openDetail, toggleSelect, toggleAll,
    bulkConfirm, bulkDelete, handleUpload, saveEdits, confirmDoc, deleteDoc,
    addLineItem, removeLineItem, updateLi, closeUpload,
  } = inv;

  return (
    <div className="flex h-full bg-subtle">
      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-default shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-gradient-primary shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-content-primary">Hóa đơn VAT đầu vào</h1>
              <p className="text-sm text-content-muted mt-0.5">Nhận dạng và xử lý hóa đơn VAT qua OCR</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadStats(); loadDocs(); }}
              className="p-2 rounded-lg text-content-muted hover:bg-subtle transition-colors"
              title="Làm mới"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 bg-gradient-primary text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md hover:opacity-95 transition-all"
            >
              <Upload className="w-4 h-4" />
              Tải lên hóa đơn
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-3">
              <StatCard label="Tổng số"      value={stats.total}     colorClass="text-content-primary"    borderCls="border-l-default"    />
              <StatCard label="Nháp"         value={stats.draft}     colorClass="text-content-secondary"  borderCls="border-l-default"    />
              <StatCard label="Đã xử lý"     value={stats.processed} colorClass="text-primary-600" borderCls="border-l-primary-500" />
              <StatCard label="Đã xác nhận"  value={stats.confirmed} colorClass="text-success-600" borderCls="border-l-success-500" />
              <StatCard label="Lỗi"          value={stats.error}     colorClass="text-danger-600"  borderCls="border-l-danger-500"  />
            </div>
          )}

          {/* Filters */}
          <div className="bg-surface rounded-lg border border-default shadow-sm p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-content-secondary mb-1">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Số HĐ, tên người bán, tên file..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-subtle text-content-primary placeholder:text-content-muted"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Trạng thái</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 py-1.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
              >
                <option value="">Tất cả</option>
                <option value="DRAFT">Nháp</option>
                <option value="PROCESSED">Đã xử lý</option>
                <option value="CONFIRMED">Đã xác nhận</option>
                <option value="ERROR">Lỗi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Từ ngày</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="h-9 px-3 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Đến ngày</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="h-9 px-3 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary" />
            </div>
            {(search || statusFilter || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                className="h-9 px-3 text-sm text-content-muted hover:text-content-secondary border border-default rounded-lg hover:bg-subtle transition-colors"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="bg-primary-50/10 border border-primary-500/30 rounded-lg px-4 py-2.5 flex items-center gap-4">
              <span className="text-sm font-medium text-primary-700">Đã chọn {selectedIds.size} chứng từ</span>
              <button onClick={bulkConfirm} className="flex items-center gap-1.5 text-sm text-success-600 hover:text-success-500 font-medium">
                <CheckCircle className="w-4 h-4" /> Xác nhận tất cả
              </button>
              <button onClick={bulkDelete} className="flex items-center gap-1.5 text-sm text-danger-600 hover:text-danger-500 font-medium">
                <Trash2 className="w-4 h-4" /> Xóa tất cả
              </button>
              <button onClick={() => inv.setSelectedIds(new Set())} className="ml-auto text-sm text-content-muted hover:text-content-secondary">Bỏ chọn</button>
            </div>
          )}

          {pageError && (
            <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {pageError}
            </div>
          )}

          {/* Table */}
          <div className="bg-surface rounded-lg border border-default shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default bg-subtle text-xs font-semibold text-content-muted uppercase tracking-wide">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={!!docs?.items.length && selectedIds.size === docs.items.length} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left">Tên file</th>
                  <th className="px-4 py-3 text-left">Số hóa đơn</th>
                  <th className="px-4 py-3 text-left">Người bán</th>
                  <th className="px-4 py-3 text-right">Tổng tiền (VND)</th>
                  <th className="px-4 py-3 text-left">Ngày HĐ</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-strong">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-content-muted">Đang tải...</td></tr>
                ) : !docs?.items.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <FileText className="w-10 h-10 text-content-muted mx-auto mb-2 opacity-50" />
                      <p className="text-content-muted text-sm">Không có dữ liệu</p>
                    </td>
                  </tr>
                ) : docs.items.map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => openDetail(doc.id)}
                    className={`cursor-pointer transition-colors hover:bg-subtle ${selectedDoc?.id === doc.id ? 'bg-primary-50/10' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}>
                      <input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => {}} className="rounded" />
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-content-muted shrink-0" />
                        <span className="truncate font-medium text-content-primary text-xs">{doc.fileName ?? doc.id.slice(0, 12) + '...'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-content-secondary">{doc.invoiceNumber ?? '—'}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-content-secondary">{doc.sellerName ?? '—'}</p>
                      {doc.sellerTaxCode && <p className="text-xs text-content-muted truncate">{doc.sellerTaxCode}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-content-secondary">{fmt(doc.grandTotal)}</td>
                    <td className="px-4 py-3 text-content-muted whitespace-nowrap">{fmtDate(doc.issueDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteDoc(doc.id)} className="p-1.5 text-content-muted hover:text-danger-500 hover:bg-danger-500/10 rounded transition-colors" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {docs && docs.totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-content-muted">{(docs.page - 1) * 20 + 1}–{Math.min(docs.page * 20, docs.total)} / {docs.total} chứng từ</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={docs.page === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-subtle transition-colors">
                  <ChevronLeft className="w-4 h-4 text-content-secondary" />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-content-primary">{docs.page} / {docs.totalPages}</span>
                <button onClick={() => setPage(p => Math.min(docs.totalPages, p + 1))} disabled={docs.page === docs.totalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-subtle transition-colors">
                  <ChevronRight className="w-4 h-4 text-content-secondary" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {(selectedDoc || detailLoading) && (
        <div className="fixed top-0 right-0 h-screen w-[500px] bg-surface border-l border-default shadow-2xl z-30 flex flex-col">
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-content-muted text-sm">Đang tải...</div>
          ) : selectedDoc ? (
            <>
              <div className="px-5 py-4 border-b border-default">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={selectedDoc.status} />
                      {selectedDoc.ocrConfidence != null && (
                        <span className="text-xs text-content-muted">OCR {(selectedDoc.ocrConfidence * 100).toFixed(0)}%</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-content-primary text-sm truncate">{selectedDoc.fileName ?? selectedDoc.id}</h3>
                    <p className="text-xs text-content-muted mt-0.5">Tải lên {fmtDateTime(selectedDoc.createdAt)}</p>
                  </div>
                  <button onClick={() => setSelectedDoc(null)} className="shrink-0 p-1.5 rounded-lg text-content-muted hover:text-content-secondary hover:bg-subtle transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="border-b border-default px-5 flex">
                {(['info', 'lines', 'audit'] as const).map(tab => {
                  const labels = { info: 'Thông tin', lines: 'Dòng hàng', audit: 'Nhật ký' };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-content-muted hover:text-content-primary'}`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {activeTab === 'info' && (
                  <div className="space-y-3">
                    {selectedDoc.status === 'ERROR' && selectedDoc.ocrError && (
                      <div className="flex items-start gap-2 bg-danger-50/10 border border-danger-500/30 rounded-lg p-3 text-sm text-danger-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{selectedDoc.ocrError}</span>
                      </div>
                    )}
                    {selectedDoc.schema.fields.length === 0 ? (
                      <p className="text-sm text-content-muted text-center py-6">Schema không có trường nào.</p>
                    ) : selectedDoc.schema.fields.map(field => (
                      <div key={field.id}>
                        <label className="block text-xs font-medium text-content-secondary mb-1">
                          {field.label}
                          {field.isRequired && <span className="text-danger-500 ml-0.5">*</span>}
                          {selectedDoc.values.find(v => v.fieldId === field.id)?.isManuallyEdited && (
                            <span className="ml-1 text-warning-600 text-[10px]">Đã sửa</span>
                          )}
                        </label>
                        <input
                          type={field.dataType === 'DATE' ? 'date' : field.dataType === 'NUMBER' || field.dataType === 'CURRENCY' ? 'number' : 'text'}
                          value={editValues[field.id] ?? ''}
                          onChange={e => { setEditValues(prev => ({ ...prev, [field.id]: e.target.value })); inv.setEditDirty(true); }}
                          disabled={selectedDoc.status === 'CONFIRMED'}
                          placeholder={`Nhập ${field.label.toLowerCase()}`}
                          className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-subtle disabled:text-content-muted bg-surface text-content-primary"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'lines' && (
                  <div>
                    <div className="overflow-x-auto rounded-lg border border-default mb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-subtle border-b border-default text-content-secondary uppercase tracking-wide font-semibold">
                            <th className="px-2 py-2 text-center w-8">#</th>
                            <th className="px-2 py-2 text-left min-w-[100px]">Tên hàng</th>
                            <th className="px-2 py-2 w-14">ĐVT</th>
                            <th className="px-2 py-2 text-right w-16">SL</th>
                            <th className="px-2 py-2 text-right w-20">Đơn giá</th>
                            <th className="px-2 py-2 text-right w-20">Thành tiền</th>
                            {selectedDoc.status !== 'CONFIRMED' && <th className="w-7" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-strong">
                          {editLineItems.length === 0 ? (
                            <tr><td colSpan={7} className="px-3 py-5 text-center text-content-muted">Không có dòng hàng</td></tr>
                          ) : editLineItems.map((li: LineItem) => (
                            <tr key={li.stt} className="hover:bg-subtle transition-colors">
                              <td className="px-2 py-1.5 text-center text-content-muted">{li.stt}</td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={li.name ?? ''} onChange={e => updateLi(li.stt, 'name', e.target.value)} disabled={selectedDoc.status === 'CONFIRMED'} className="w-full text-xs bg-transparent text-content-primary focus:outline-none focus:ring-1 focus:ring-primary-400 rounded px-1" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={li.unit ?? ''} onChange={e => updateLi(li.stt, 'unit', e.target.value)} disabled={selectedDoc.status === 'CONFIRMED'} className="w-full text-xs bg-transparent text-content-primary focus:outline-none focus:ring-1 focus:ring-primary-400 rounded px-1 text-center" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={li.quantity ?? ''} onChange={e => updateLi(li.stt, 'quantity', e.target.value ? Number(e.target.value) : null)} disabled={selectedDoc.status === 'CONFIRMED'} className="w-full text-xs bg-transparent text-content-primary text-right focus:outline-none focus:ring-1 focus:ring-primary-400 rounded px-1" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={li.unitPrice ?? ''} onChange={e => updateLi(li.stt, 'unitPrice', e.target.value ? Number(e.target.value) : null)} disabled={selectedDoc.status === 'CONFIRMED'} className="w-full text-xs bg-transparent text-content-primary text-right focus:outline-none focus:ring-1 focus:ring-primary-400 rounded px-1" />
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono text-content-secondary">{fmt(li.amount)}</td>
                              {selectedDoc.status !== 'CONFIRMED' && (
                                <td className="px-1 py-1.5">
                                  <button onClick={() => removeLineItem(li.stt)} className="p-1 text-content-muted hover:text-danger-500 rounded">
                                    <Minus className="w-3 h-3" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {selectedDoc.status !== 'CONFIRMED' && (
                      <button onClick={addLineItem} className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                        <Plus className="w-4 h-4" /> Thêm dòng hàng
                      </button>
                    )}
                    {editLineItems.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-default text-right space-y-0.5">
                        <p className="text-xs text-content-secondary">Tổng chưa thuế: <span className="font-medium text-content-primary">{fmt(selectedDoc.totalAmount)}</span></p>
                        <p className="text-xs text-content-secondary">VAT: <span className="font-medium text-content-primary">{fmt(selectedDoc.vatAmount)}</span></p>
                        <p className="text-sm font-semibold text-content-primary">Tổng thanh toán: {fmt(selectedDoc.grandTotal)}</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'audit' && (
                  <div className="space-y-3">
                    {selectedDoc.auditLogs.length === 0 ? (
                      <p className="text-sm text-content-muted text-center py-6">Không có nhật ký.</p>
                    ) : selectedDoc.auditLogs.map(log => (
                      <div key={log.id} className="flex gap-3">
                        <div className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-subtle flex items-center justify-center">
                          <Clock className="w-3 h-3 text-content-muted" />
                        </div>
                        <div className="flex-1 min-w-0 pb-3 border-b border-default last:border-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-content-primary">{ACTION_LABEL[log.action] ?? log.action}</span>
                            {log.newStatus && <StatusBadge status={log.newStatus} />}
                          </div>
                          {log.note && <p className="text-xs text-content-muted mt-0.5">{log.note}</p>}
                          <p className="text-xs text-content-muted mt-0.5">{log.changedBy} · {fmtDateTime(log.changedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedDoc.status !== 'CONFIRMED' && (
                <div className="border-t border-default p-4 flex gap-2 bg-surface">
                  {editDirty && (
                    <button onClick={saveEdits} disabled={saveLoading} className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
                      <Save className="w-4 h-4" />
                      {saveLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  )}
                  {(selectedDoc.status === 'DRAFT' || selectedDoc.status === 'PROCESSED') && (
                    <button onClick={confirmDoc} disabled={confirmLoading || editDirty} title={editDirty ? 'Lưu thay đổi trước khi xác nhận' : undefined} className="flex-1 flex items-center justify-center gap-2 bg-success-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-success-700 disabled:opacity-50 transition-colors">
                      <Check className="w-4 h-4" />
                      {confirmLoading ? 'Đang xác nhận...' : 'Xác nhận'}
                    </button>
                  )}
                  <button onClick={() => deleteDoc(selectedDoc.id)} className="p-2 text-content-muted hover:text-danger-500 hover:bg-danger-500/10 rounded-lg border border-default transition-colors" title="Xóa chứng từ">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md border border-default">
            <div className="flex items-center justify-between px-6 py-4 border-b border-default">
              <h2 className="text-base font-semibold text-content-primary">Tải lên hóa đơn OCR</h2>
              <button onClick={closeUpload} className="p-1.5 rounded-lg text-content-muted hover:text-content-secondary hover:bg-subtle transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploadFile(f); }}
                className="border-2 border-dashed border-default rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-subtle transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.docx"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-primary-500 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-content-primary truncate">{uploadFile.name}</p>
                      <p className="text-xs text-content-muted">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setUploadFile(null); }} className="ml-auto p-1 text-content-muted hover:text-danger-500 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-content-muted mx-auto mb-2 opacity-70" />
                    <p className="text-sm font-medium text-content-secondary">Kéo thả hoặc nhấp để chọn file</p>
                    <p className="text-xs text-content-muted mt-1">PDF, PNG, JPEG, TIFF, DOCX – tối đa 25 MB</p>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">Schema chứng từ</label>
                <select value={uploadSchemaId} onChange={e => setUploadSchemaId(e.target.value)} className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary">
                  <option value="">— Chọn schema —</option>
                  {schemas.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
                {schemas.length === 0 && <p className="text-xs text-warning-600 mt-1">Chưa có schema INVOICE. Hãy tạo schema trong Cấu hình OCR.</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">Ngôn ngữ</label>
                <select value={uploadLanguage} onChange={e => setUploadLanguage(e.target.value as 'vi' | 'en' | 'vi+en')} className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary">
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="vi+en">Việt + English</option>
                </select>
              </div>
              {uploadMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm border ${uploadMsg.startsWith('Lỗi') ? 'bg-danger-50/10 text-danger-700 border-danger-500/30' : 'bg-success-50/10 text-success-700 border-success-500/30'}`}>
                  {uploadMsg.startsWith('Lỗi') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                  {uploadMsg}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-default flex justify-end gap-3">
              <button onClick={closeUpload} className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary border border-default rounded-lg hover:bg-subtle transition-colors">Hủy</button>
              <button onClick={handleUpload} disabled={!uploadFile || !uploadSchemaId || uploadLoading} className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {uploadLoading ? 'Đang xử lý...' : 'Tải lên & OCR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
