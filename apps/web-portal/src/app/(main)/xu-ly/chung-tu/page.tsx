'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, ChevronLeft, ChevronRight, FileText, AlertCircle,
  Pencil, Trash2, Download, X, Database, Check,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocListItem, DocStats } from '@/lib/ocr-api';

const STATUS_CONFIG = {
  DRAFT:     { label: 'Nháp',          cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  PROCESSED: { label: 'Đã chuyển kho', cls: 'bg-purple-50 text-purple-600 border-purple-200' },
  CONFIRMED: { label: 'Đã xác nhận',   cls: 'bg-green-50  text-green-600  border-green-200' },
  ERROR:     { label: 'Lỗi',           cls: 'bg-red-50    text-red-600    border-red-200' },
} as const;

const TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  INVOICE:           { label: 'Hóa đơn VAT',    cls: 'bg-blue-50  text-blue-600  border-blue-200' },
  RECEIPT:           { label: 'Hóa đơn bán lẻ', cls: 'bg-cyan-50  text-cyan-600  border-cyan-200' },
  CONTRACT:          { label: 'Hợp đồng',        cls: 'bg-green-50 text-green-600 border-green-200' },
  STATEMENT:         { label: 'Bảng kê',         cls: 'bg-gray-50  text-gray-600  border-gray-200' },
  MINUTES:           { label: 'Biên bản',        cls: 'bg-sky-50   text-sky-600   border-sky-200' },
  WAREHOUSE_RECEIPT: { label: 'Phiếu nhập kho',  cls: 'bg-teal-50  text-teal-600  border-teal-200' },
  OTHERS:            { label: 'Khác',            cls: 'bg-gray-50  text-gray-500  border-gray-200' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_CONFIG[type] ?? { label: type, cls: 'bg-gray-50 text-gray-500 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${t.cls}`}>
      {t.label}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
}

function StatCard({
  label, value, colorClass,
}: { label: string; value: number; colorClass: string }) {
  return (
    <div className="bg-white rounded-xl border px-5 py-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value.toLocaleString('vi-VN')}</p>
    </div>
  );
}

export default function ChungTuPage() {
  const [stats, setStats]       = useState<DocStats | null>(null);
  const [docs, setDocs]         = useState<{ items: DocListItem[]; total: number; totalPages: number; page: number } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [page, setPage]               = useState(1);

  // Edit modal
  const [editDoc, setEditDoc]     = useState<DocListItem | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Transfer modal
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferIds, setTransferIds]   = useState<string[]>([]);
  const [transferring, setTransferring] = useState(false);

  const loadStats = useCallback(async () => {
    try { setStats(await ocrApi.getStats()); } catch { /* silent */ }
  }, []);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: Record<string, string | string[]> = { page: String(page), pageSize: '25' };
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter)   params.type   = typeFilter;
      setDocs(await ocrApi.getDocuments(params));
    } catch (e: unknown) {
      setPageError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    if (!docs) return;
    const all = docs.items.map(d => d.id);
    setSelectedIds(prev => prev.size === all.length ? new Set() : new Set(all));
  };

  const handleBulkConfirm = async () => {
    try {
      await ocrApi.bulkConfirm([...selectedIds]);
      setSelectedIds(new Set());
      await Promise.all([loadStats(), loadDocs()]);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const openTransferModal = (ids: string[]) => {
    setTransferIds(ids);
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    setTransferring(true);
    try {
      await ocrApi.bulkConfirm(transferIds);
      setSelectedIds(new Set());
      setTransferOpen(false);
      await Promise.all([loadStats(), loadDocs()]);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setTransferring(false);
    }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('Xóa chứng từ này?')) return;
    try {
      await ocrApi.deleteDocument(id);
      await Promise.all([loadStats(), loadDocs()]);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const openEditModal = (doc: DocListItem) => {
    setEditDoc(doc);
    setEditStatus(doc.status);
  };

  const handleSaveEdit = async () => {
    if (!editDoc) return;
    setEditSaving(true);
    try {
      if (editStatus === 'CONFIRMED' && editDoc.status !== 'CONFIRMED') {
        await ocrApi.confirmDocument(editDoc.id);
      }
      setEditDoc(null);
      await Promise.all([loadStats(), loadDocs()]);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (!docs?.items.length) return;
    const rows = docs.items.map((d, i) => ({
      STT: (page - 1) * 25 + i + 1,
      'Mã chứng từ': d.invoiceNumber ?? d.id.slice(0, 12),
      'Tên chứng từ': d.fileName ?? d.schema.name,
      Loại: TYPE_CONFIG[d.schema.type]?.label ?? d.schema.type,
      'Ngày OCR': fmtDate(d.createdAt),
      'Trạng thái': STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG]?.label ?? d.status,
    }));
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'chung-tu.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quản lý Chứng từ</h1>
          <p className="text-sm text-gray-500 mt-0.5">Danh sách tất cả chứng từ đã xử lý OCR</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>
          <button
            onClick={() => openTransferModal(selectedIds.size > 0 ? [...selectedIds] : (docs?.items.map(d => d.id) ?? []))}
            className="flex items-center gap-2 bg-[#0d4f4f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a3d3d] transition-colors"
          >
            <Database className="w-4 h-4" />
            Chuyển vào kho tri thức
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Tổng chứng từ"  value={stats.total}     colorClass="text-gray-800" />
            <StatCard label="Nháp"           value={stats.draft}     colorClass="text-orange-500" />
            <StatCard label="Đã xác nhận"    value={stats.confirmed} colorClass="text-green-600" />
            <StatCard label="Đã chuyển kho"  value={stats.processed} colorClass="text-purple-600" />
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Tìm kiếm chứng từ..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="PROCESSED">Đã chuyển kho</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="ERROR">Lỗi</option>
          </select>
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {(search || statusFilter || typeFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1); }}
              className="h-9 px-3 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-blue-700">
              Đã chọn {selectedIds.size} chứng từ
            </span>
            <button
              onClick={handleBulkConfirm}
              className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 font-medium"
            >
              <Check className="w-4 h-4" /> Xác nhận hàng loạt
            </button>
            <button
              onClick={() => openTransferModal([...selectedIds])}
              className="flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-800 font-medium"
            >
              <Database className="w-4 h-4" /> Chuyển vào kho tri thức
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-3.5 h-3.5" /> Bỏ chọn
            </button>
          </div>
        )}

        {pageError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {pageError}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : !docs?.items.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Không có chứng từ nào</p>
                  </td>
                </tr>
              ) : docs.items.map((doc, idx) => (
                <tr
                  key={doc.id}
                  className={`border-b last:border-0 transition-colors ${
                    selectedIds.has(doc.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => {}}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {(page - 1) * 25 + idx + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {doc.invoiceNumber ?? doc.id.slice(0, 10) + '...'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{doc.fileName ?? doc.schema.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={doc.schema.type} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {fmtDate(doc.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">—</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditModal(doc)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Sửa chứng từ"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteDoc(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa chứng từ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
              {(docs.page - 1) * 25 + 1}–{Math.min(docs.page * 25, docs.total)} / {docs.total} chứng từ
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={docs.page === 1}
                className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700">
                {docs.page} / {docs.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(docs.totalPages, p + 1))}
                disabled={docs.page === docs.totalPages}
                className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">Sửa chứng từ OCR</h2>
              <button
                onClick={() => setEditDoc(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mã chứng từ</label>
                <input
                  type="text"
                  readOnly
                  value={editDoc.invoiceNumber ?? editDoc.id.slice(0, 12) + '...'}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tên chứng từ</label>
                <input
                  type="text"
                  readOnly
                  value={editDoc.fileName ?? editDoc.schema.name}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Loại chứng từ</label>
                <input
                  type="text"
                  readOnly
                  value={TYPE_CONFIG[editDoc.schema.type]?.label ?? editDoc.schema.type}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Trạng thái</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="DRAFT">Nháp</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setEditDoc(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer to knowledge warehouse modal */}
      {transferOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
                <Database className="w-6 h-6 text-teal-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                Chuyển vào kho tri thức
              </h2>
              <p className="text-sm text-gray-500">
                Bạn có chắc chắn muốn chuyển{' '}
                <span className="font-semibold text-gray-700">{transferIds.length}</span>{' '}
                chứng từ vào kho tri thức không?
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-center gap-3">
              <button
                onClick={() => setTransferOpen(false)}
                disabled={transferring}
                className="px-6 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="px-6 py-2 text-sm font-medium bg-[#0d4f4f] text-white rounded-lg hover:bg-[#0a3d3d] disabled:opacity-50"
              >
                {transferring ? 'Đang chuyển...' : 'Chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
