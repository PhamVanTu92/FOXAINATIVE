'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Search, RefreshCw, CheckCircle, Trash2, X,
  ChevronLeft, ChevronRight, FileText, Plus, Minus,
  AlertCircle, Check, Save, Clock,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocDetail, DocListItem, DocStats, SchemaListItem, LineItem } from '@/lib/ocr-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:     { label: 'Nháp',        cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  PROCESSED: { label: 'Đã xử lý',    cls: 'bg-blue-50  text-blue-700  border-blue-200' },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'bg-green-50 text-green-700 border-green-200' },
  ERROR:     { label: 'Lỗi',         cls: 'bg-red-50   text-red-700   border-red-200' },
} as const;

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
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
  CREATE: 'Tạo mới',
  EDIT_FIELD: 'Sửa trường',
  STATUS_CHANGE: 'Thay đổi trạng thái',
  DELETE: 'Xóa',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="bg-white rounded-lg border px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${colorClass}`}>{value.toLocaleString('vi-VN')}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HoaDonVatPage() {
  // Data
  const [stats, setStats] = useState<DocStats | null>(null);
  const [docs, setDocs] = useState<{ items: DocListItem[]; total: number; totalPages: number; page: number } | null>(null);
  const [schemas, setSchemas] = useState<SchemaListItem[]>([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'lines' | 'audit'>('info');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSchemaId, setUploadSchemaId] = useState('');
  const [uploadLanguage, setUploadLanguage] = useState<'vi' | 'en' | 'vi+en'>('vi');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);
  const [editDirty, setEditDirty] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try { setStats(await ocrApi.getStats()); } catch { /* silent */ }
  }, []);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: Record<string, string | string[]> = {
        page: String(page),
        pageSize: '20',
        type: 'INVOICE',
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      setDocs(await ocrApi.getDocuments(params));
    } catch (e: unknown) {
      setPageError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  useEffect(() => {
    ocrApi.getSchemas({ type: 'INVOICE', isActive: 'true' }).then(list => {
      setSchemas(list);
      if (list.length && !uploadSchemaId) setUploadSchemaId(list[0]!.id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detail ───────────────────────────────────────────────────────────────────

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedDoc(null);
    setActiveTab('info');
    try {
      const doc = await ocrApi.getDocument(id);
      setSelectedDoc(doc);
      const vals: Record<string, string> = {};
      for (const v of doc.values) vals[v.fieldId] = v.stringValue ?? '';
      setEditValues(vals);
      setEditLineItems([...doc.lineItems]);
      setEditDirty(false);
    } catch (e: unknown) {
      setPageError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    if (!docs) return;
    const all = docs.items.map(d => d.id);
    setSelectedIds(prev => prev.size === all.length ? new Set() : new Set(all));
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  const bulkConfirm = async () => {
    try {
      const res = await ocrApi.bulkConfirm([...selectedIds]);
      setSelectedIds(new Set());
      await Promise.all([loadStats(), loadDocs()]);
      alert(`Đã xác nhận ${res.confirmed} chứng từ.`);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const bulkDelete = async () => {
    if (!confirm(`Xóa ${selectedIds.size} chứng từ đã chọn?`)) return;
    try {
      const ids = [...selectedIds];
      const res = await ocrApi.bulkDelete(ids);
      setSelectedIds(new Set());
      if (selectedDoc && ids.includes(selectedDoc.id)) setSelectedDoc(null);
      await Promise.all([loadStats(), loadDocs()]);
      alert(`Đã xóa ${res.deleted} chứng từ.`);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  // ── Upload ───────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadFile || !uploadSchemaId) return;
    setUploadLoading(true);
    setUploadMsg(null);
    try {
      const res = await ocrApi.uploadDocument(uploadFile, uploadSchemaId, uploadLanguage);
      setUploadMsg(res.message);
      setUploadFile(null);
      await Promise.all([loadStats(), loadDocs()]);
      setTimeout(() => { setUploadOpen(false); setUploadMsg(null); }, 2000);
    } catch (e: unknown) {
      setUploadMsg(`Lỗi: ${(e as Error).message}`);
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Save / Confirm / Delete ───────────────────────────────────────────────────

  const saveEdits = async () => {
    if (!selectedDoc) return;
    setSaveLoading(true);
    try {
      const values = Object.entries(editValues).map(([fieldId, stringValue]) => ({ fieldId, stringValue }));
      const lineItems = editLineItems.map(({ stt, name, unit, quantity, unitPrice, amount }) =>
        ({ stt, name, unit, quantity, unitPrice, amount }),
      );
      const updated = await ocrApi.updateDocument(selectedDoc.id, { values, lineItems });
      setSelectedDoc(updated);
      setEditDirty(false);
      await loadDocs();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSaveLoading(false); }
  };

  const confirmDoc = async () => {
    if (!selectedDoc || !confirm('Xác nhận chứng từ này?')) return;
    setConfirmLoading(true);
    try {
      const updated = await ocrApi.confirmDocument(selectedDoc.id);
      setSelectedDoc(updated);
      await Promise.all([loadStats(), loadDocs()]);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setConfirmLoading(false); }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('Xóa chứng từ này?')) return;
    try {
      await ocrApi.deleteDocument(id);
      if (selectedDoc?.id === id) setSelectedDoc(null);
      await Promise.all([loadStats(), loadDocs()]);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  // ── Line item editing ─────────────────────────────────────────────────────────

  const addLineItem = () => {
    const stt = editLineItems.length ? Math.max(...editLineItems.map(li => li.stt)) + 1 : 1;
    setEditLineItems(prev => [
      ...prev,
      { id: '', stt, name: '', unit: '', quantity: null, unitPrice: null, amount: null, isManuallyAdded: true },
    ]);
    setEditDirty(true);
  };

  const removeLineItem = (stt: number) => {
    setEditLineItems(prev => prev.filter(li => li.stt !== stt));
    setEditDirty(true);
  };

  const updateLi = (stt: number, key: keyof LineItem, value: string | number | null) => {
    setEditLineItems(prev => prev.map(li => li.stt === stt ? { ...li, [key]: value } : li));
    setEditDirty(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const closeUpload = () => { setUploadOpen(false); setUploadFile(null); setUploadMsg(null); };

  return (
    <div className="flex h-full bg-gray-50">

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Hóa đơn VAT đầu vào</h1>
            <p className="text-sm text-gray-500 mt-0.5">Nhận dạng và xử lý hóa đơn VAT qua OCR</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadStats(); loadDocs(); }}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title="Làm mới"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
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
              <StatCard label="Tổng số" value={stats.total} colorClass="text-gray-800" />
              <StatCard label="Nháp" value={stats.draft} colorClass="text-gray-500" />
              <StatCard label="Đã xử lý" value={stats.processed} colorClass="text-blue-600" />
              <StatCard label="Đã xác nhận" value={stats.confirmed} colorClass="text-green-600" />
              <StatCard label="Lỗi" value={stats.error} colorClass="text-red-600" />
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Số HĐ, tên người bán, tên file..."
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Tất cả</option>
                <option value="DRAFT">Nháp</option>
                <option value="PROCESSED">Đã xử lý</option>
                <option value="CONFIRMED">Đã xác nhận</option>
                <option value="ERROR">Lỗi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Từ ngày</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Đến ngày</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(search || statusFilter || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                className="h-9 px-3 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-4">
              <span className="text-sm font-medium text-blue-700">Đã chọn {selectedIds.size} chứng từ</span>
              <button
                onClick={bulkConfirm}
                className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 font-medium"
              >
                <CheckCircle className="w-4 h-4" /> Xác nhận tất cả
              </button>
              <button
                onClick={bulkDelete}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                <Trash2 className="w-4 h-4" /> Xóa tất cả
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-sm text-gray-500 hover:text-gray-700"
              >
                Bỏ chọn
              </button>
            </div>
          )}

          {/* Error */}
          {pageError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {pageError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!docs?.items.length && selectedIds.size === docs.items.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
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
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">Đang tải...</td>
                  </tr>
                ) : !docs?.items.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Không có dữ liệu</p>
                    </td>
                  </tr>
                ) : docs.items.map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => openDetail(doc.id)}
                    className={`border-b last:border-0 cursor-pointer hover:bg-blue-50 transition-colors ${selectedDoc?.id === doc.id ? 'bg-blue-50' : ''}`}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}
                    >
                      <input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => {}} className="rounded" />
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate font-medium text-gray-800 text-xs">
                          {doc.fileName ?? doc.id.slice(0, 12) + '...'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{doc.invoiceNumber ?? '—'}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-gray-700">{doc.sellerName ?? '—'}</p>
                      {doc.sellerTaxCode && (
                        <p className="text-xs text-gray-400 truncate">{doc.sellerTaxCode}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(doc.grandTotal)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(doc.issueDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => deleteDoc(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Xóa"
                      >
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
              <span className="text-sm text-gray-500">
                {(docs.page - 1) * 20 + 1}–{Math.min(docs.page * 20, docs.total)} / {docs.total} chứng từ
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={docs.page === 1}
                  className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-gray-700">
                  {docs.page} / {docs.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(docs.totalPages, p + 1))}
                  disabled={docs.page === docs.totalPages}
                  className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel (fixed right) ─────────────────────────────────────────── */}
      {(selectedDoc || detailLoading) && (
        <div className="fixed top-0 right-0 h-screen w-[500px] bg-white border-l shadow-2xl z-30 flex flex-col">
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
          ) : selectedDoc ? (
            <>
              {/* Panel header */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={selectedDoc.status} />
                      {selectedDoc.ocrConfidence != null && (
                        <span className="text-xs text-gray-400">
                          OCR {(selectedDoc.ocrConfidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {selectedDoc.fileName ?? selectedDoc.id}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tải lên {fmtDateTime(selectedDoc.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b px-5 flex">
                {(['info', 'lines', 'audit'] as const).map(tab => {
                  const labels = { info: 'Thông tin', lines: 'Dòng hàng', audit: 'Nhật ký' };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5">

                {/* ── Info tab ── */}
                {activeTab === 'info' && (
                  <div className="space-y-3">
                    {selectedDoc.status === 'ERROR' && selectedDoc.ocrError && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{selectedDoc.ocrError}</span>
                      </div>
                    )}
                    {selectedDoc.schema.fields.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Schema không có trường nào.</p>
                    ) : selectedDoc.schema.fields.map(field => (
                      <div key={field.id}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {field.label}
                          {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                          {selectedDoc.values.find(v => v.fieldId === field.id)?.isManuallyEdited && (
                            <span className="ml-1 text-orange-400 text-[10px]">Đã sửa</span>
                          )}
                        </label>
                        <input
                          type={
                            field.dataType === 'DATE' ? 'date'
                            : field.dataType === 'NUMBER' || field.dataType === 'CURRENCY' ? 'number'
                            : 'text'
                          }
                          value={editValues[field.id] ?? ''}
                          onChange={e => {
                            setEditValues(prev => ({ ...prev, [field.id]: e.target.value }));
                            setEditDirty(true);
                          }}
                          disabled={selectedDoc.status === 'CONFIRMED'}
                          placeholder={`Nhập ${field.label.toLowerCase()}`}
                          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Lines tab ── */}
                {activeTab === 'lines' && (
                  <div>
                    <div className="overflow-x-auto rounded-lg border mb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b text-gray-600 uppercase tracking-wide font-semibold">
                            <th className="px-2 py-2 text-center w-8">#</th>
                            <th className="px-2 py-2 text-left min-w-[100px]">Tên hàng</th>
                            <th className="px-2 py-2 w-14">ĐVT</th>
                            <th className="px-2 py-2 text-right w-16">SL</th>
                            <th className="px-2 py-2 text-right w-20">Đơn giá</th>
                            <th className="px-2 py-2 text-right w-20">Thành tiền</th>
                            {selectedDoc.status !== 'CONFIRMED' && <th className="w-7" />}
                          </tr>
                        </thead>
                        <tbody>
                          {editLineItems.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-5 text-center text-gray-400">
                                Không có dòng hàng
                              </td>
                            </tr>
                          ) : editLineItems.map(li => (
                            <tr key={li.stt} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-2 py-1.5 text-center text-gray-400">{li.stt}</td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={li.name ?? ''}
                                  onChange={e => updateLi(li.stt, 'name', e.target.value)}
                                  disabled={selectedDoc.status === 'CONFIRMED'}
                                  className="w-full text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={li.unit ?? ''}
                                  onChange={e => updateLi(li.stt, 'unit', e.target.value)}
                                  disabled={selectedDoc.status === 'CONFIRMED'}
                                  className="w-full text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  value={li.quantity ?? ''}
                                  onChange={e => updateLi(li.stt, 'quantity', e.target.value ? Number(e.target.value) : null)}
                                  disabled={selectedDoc.status === 'CONFIRMED'}
                                  className="w-full text-xs bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  value={li.unitPrice ?? ''}
                                  onChange={e => updateLi(li.stt, 'unitPrice', e.target.value ? Number(e.target.value) : null)}
                                  disabled={selectedDoc.status === 'CONFIRMED'}
                                  className="w-full text-xs bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono text-gray-700">{fmt(li.amount)}</td>
                              {selectedDoc.status !== 'CONFIRMED' && (
                                <td className="px-1 py-1.5">
                                  <button
                                    onClick={() => removeLineItem(li.stt)}
                                    className="p-1 text-gray-300 hover:text-red-400 rounded"
                                  >
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
                      <button
                        onClick={addLineItem}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Plus className="w-4 h-4" /> Thêm dòng hàng
                      </button>
                    )}
                    {editLineItems.length > 0 && (
                      <div className="mt-4 pt-3 border-t text-right space-y-0.5">
                        <p className="text-xs text-gray-500">
                          Tổng chưa thuế: <span className="font-medium text-gray-700">{fmt(selectedDoc.totalAmount)}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          VAT: <span className="font-medium text-gray-700">{fmt(selectedDoc.vatAmount)}</span>
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          Tổng thanh toán: {fmt(selectedDoc.grandTotal)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Audit tab ── */}
                {activeTab === 'audit' && (
                  <div className="space-y-3">
                    {selectedDoc.auditLogs.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Không có nhật ký.</p>
                    ) : selectedDoc.auditLogs.map(log => (
                      <div key={log.id} className="flex gap-3">
                        <div className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-gray-100 flex items-center justify-center">
                          <Clock className="w-3 h-3 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0 pb-3 border-b last:border-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-800">
                              {ACTION_LABEL[log.action] ?? log.action}
                            </span>
                            {log.newStatus && <StatusBadge status={log.newStatus} />}
                          </div>
                          {log.note && <p className="text-xs text-gray-500 mt-0.5">{log.note}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {log.changedBy} · {fmtDateTime(log.changedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Panel footer */}
              {selectedDoc.status !== 'CONFIRMED' && (
                <div className="border-t p-4 flex gap-2 bg-white">
                  {editDirty && (
                    <button
                      onClick={saveEdits}
                      disabled={saveLoading}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {saveLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  )}
                  {(selectedDoc.status === 'DRAFT' || selectedDoc.status === 'PROCESSED') && (
                    <button
                      onClick={confirmDoc}
                      disabled={confirmLoading || editDirty}
                      title={editDirty ? 'Lưu thay đổi trước khi xác nhận' : undefined}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {confirmLoading ? 'Đang xác nhận...' : 'Xác nhận'}
                    </button>
                  )}
                  <button
                    onClick={() => deleteDoc(selectedDoc.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg border transition-colors"
                    title="Xóa chứng từ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── Upload modal ──────────────────────────────────────────────────────── */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">Tải lên hóa đơn OCR</h2>
              <button onClick={closeUpload} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploadFile(f); }}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
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
                    <FileText className="w-8 h-8 text-blue-500 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{uploadFile.name}</p>
                      <p className="text-xs text-gray-400">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                      className="ml-auto p-1 text-gray-400 hover:text-red-400 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">Kéo thả hoặc nhấp để chọn file</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPEG, TIFF, DOCX – tối đa 25 MB</p>
                  </>
                )}
              </div>

              {/* Schema */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Schema chứng từ</label>
                <select
                  value={uploadSchemaId}
                  onChange={e => setUploadSchemaId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— Chọn schema —</option>
                  {schemas.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                {schemas.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    Chưa có schema INVOICE. Hãy tạo schema trong Cấu hình OCR.
                  </p>
                )}
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Ngôn ngữ</label>
                <select
                  value={uploadLanguage}
                  onChange={e => setUploadLanguage(e.target.value as 'vi' | 'en' | 'vi+en')}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="vi+en">Việt + English</option>
                </select>
              </div>

              {/* Message */}
              {uploadMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm border ${uploadMsg.startsWith('Lỗi') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                  {uploadMsg.startsWith('Lỗi')
                    ? <AlertCircle className="w-4 h-4 shrink-0" />
                    : <Check className="w-4 h-4 shrink-0" />}
                  {uploadMsg}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={closeUpload}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadSchemaId || uploadLoading}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploadLoading ? 'Đang xử lý...' : 'Tải lên & OCR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
