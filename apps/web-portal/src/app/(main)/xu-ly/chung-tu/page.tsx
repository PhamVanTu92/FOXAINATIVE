'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ChevronLeft, ChevronRight, FileText, AlertCircle,
  Pencil, Trash2, Download, X, Database, Check, Eye,
  ClipboardList, Clock, TrendingUp, Loader2, ZoomIn, Table2, Image as ImageIcon,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocListItem, DocStats, DocDetail } from '@/lib/ocr-api';
import * as XLSX from 'xlsx';

const STATUS_CONFIG = {
  DRAFT:       { label: 'Đang xử lý',   cls: 'bg-gray-50    text-gray-500   border-gray-200'  },
  PROCESSED:   { label: 'Nháp',         cls: 'bg-orange-50  text-orange-600 border-orange-200' },
  CONFIRMED:   { label: 'Đã xác nhận',  cls: 'bg-green-50   text-green-600  border-green-200'  },
  TRANSFERRED: { label: 'Đã chuyển kho',cls: 'bg-purple-50  text-purple-600 border-purple-200' },
  ERROR:       { label: 'Lỗi',          cls: 'bg-red-50     text-red-600    border-red-200'    },
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

function fmtNum(n: number | string | null | undefined) {
  if (n == null) return '—';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '—';
  return new Intl.NumberFormat('vi-VN').format(v);
}

function StatCard({
  label, value, colorClass, accentCls = 'border-gray-200',
  onClick,
}: { label: string; value: number; colorClass: string; accentCls?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-l-4 border border-gray-100 px-5 py-4 transition-shadow hover:shadow-md ${accentCls} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1.5 tabular-nums ${colorClass}`}>{value.toLocaleString('vi-VN')}</p>
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
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [sellerTaxCode, setSellerTaxCode] = useState('');
  const [exporting, setExporting]     = useState(false);
  const [page, setPage]               = useState(1);

  // Edit modal
  const [editDoc, setEditDoc]     = useState<DocListItem | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Transfer modal
  const [transferOpen, setTransferOpen]   = useState(false);
  const [transferIds, setTransferIds]     = useState<string[]>([]);
  const [transferring, setTransferring]   = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  // Detail panel
  const [detailOpen, setDetailOpen]     = useState(false);
  const [detailDoc, setDetailDoc]       = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string;
    confirmLabel: string; confirmCls: string;
    onConfirm: () => void;
  } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const showConfirm = useCallback((
    title: string, message: string, onConfirm: () => void,
    confirmLabel = 'Xác nhận', confirmCls = 'bg-blue-600 hover:bg-blue-700 text-white',
  ) => setConfirmDialog({ title, message, onConfirm, confirmLabel, confirmCls }), []);

  const loadStats = useCallback(async () => {
    try { setStats(await ocrApi.getStats()); } catch { /* silent */ }
  }, []);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: Record<string, string | string[]> = { page: String(page), pageSize: '25' };
      if (search)        params.search       = search;
      if (statusFilter)  params.status       = statusFilter;
      if (typeFilter)    params.type         = typeFilter;
      if (dateFrom)      params.dateFrom     = dateFrom;
      if (dateTo)        params.dateTo       = dateTo;
      if (sellerTaxCode) params.sellerTaxCode = sellerTaxCode;
      setDocs(await ocrApi.getDocuments(params));
    } catch (e: unknown) {
      setPageError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, dateFrom, dateTo, sellerTaxCode]);

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
      showToast('Đã xác nhận thành công.', 'success');
    } catch (e: unknown) { showToast((e as Error).message); }
  };

  const handleBulkDelete = () => {
    showConfirm(
      'Xóa hàng loạt',
      `Xóa ${selectedIds.size} chứng từ đã chọn? Chỉ chứng từ ở trạng thái "Nháp" mới bị xóa, phần còn lại bị bỏ qua.`,
      async () => {
        try {
          const res = await ocrApi.bulkDelete([...selectedIds]);
          setSelectedIds(new Set());
          await Promise.all([loadStats(), loadDocs()]);
          showToast(
            `Đã xóa ${res.deleted} chứng từ${res.skipped.length > 0 ? `, bỏ qua ${res.skipped.length}` : ''}.`,
            'success',
          );
        } catch (e: unknown) { showToast((e as Error).message); }
      },
      'Xóa', 'bg-red-600 hover:bg-red-700 text-white',
    );
  };

  const openTransferModal = (ids: string[]) => {
    const confirmedIds = ids.filter(id => docs?.items.find(d => d.id === id)?.status === 'CONFIRMED');
    setTransferIds(confirmedIds);
    setTransferOpen(true);
  };

  const openTransferAllConfirmed = useCallback(async () => {
    setLoadingTransfer(true);
    try {
      let allIds: string[] = [];
      let currentPage = 1;
      while (true) {
        const result = await ocrApi.getDocuments({ status: 'CONFIRMED', pageSize: '100', page: String(currentPage) });
        allIds = [...allIds, ...result.items.map(d => d.id)];
        if (currentPage >= result.totalPages || result.items.length === 0) break;
        currentPage++;
      }
      setTransferIds(allIds);
      setTransferOpen(true);
    } catch (e: unknown) {
      showToast((e as Error).message);
    } finally {
      setLoadingTransfer(false);
    }
  }, [showToast]);

  const handleTransfer = async () => {
    setTransferring(true);
    try {
      await ocrApi.bulkTransfer(transferIds);
      setSelectedIds(new Set());
      setTransferOpen(false);
      await Promise.all([loadStats(), loadDocs()]);
      showToast(`Đã chuyển ${transferIds.length} chứng từ vào kho tri thức.`, 'success');
    } catch (e: unknown) {
      showToast((e as Error).message);
    } finally {
      setTransferring(false);
    }
  };

  const deleteDoc = (id: string) => {
    showConfirm(
      'Xóa chứng từ',
      'Bạn có chắc chắn muốn xóa chứng từ này? Hành động này không thể hoàn tác.',
      async () => {
        try {
          await ocrApi.deleteDocument(id);
          await Promise.all([loadStats(), loadDocs()]);
          showToast('Đã xóa chứng từ.', 'success');
        } catch (e: unknown) { showToast((e as Error).message); }
      },
      'Xóa', 'bg-red-600 hover:bg-red-700 text-white',
    );
  };

  const openDetailPanel = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailDoc(null);
    try {
      setDetailDoc(await ocrApi.getDocument(id));
    } catch (e: unknown) {
      showToast((e as Error).message);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditModal = (doc: DocListItem) => {
    setEditDoc(doc);
    setEditStatus(doc.status === 'CONFIRMED' ? 'CONFIRMED' : doc.status === 'TRANSFERRED' ? 'TRANSFERRED' : 'PROCESSED');
  };

  const handleSaveEdit = async () => {
    if (!editDoc) return;
    setEditSaving(true);
    try {
      if (editStatus === 'CONFIRMED' && editDoc.status === 'PROCESSED') {
        await ocrApi.confirmDocument(editDoc.id);
      }
      setEditDoc(null);
      await Promise.all([loadStats(), loadDocs()]);
    } catch (e: unknown) {
      showToast((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleExportExcel = async () => {
    const idsToExport = selectedIds.size > 0
      ? [...selectedIds]
      : docs?.items.map(d => d.id) ?? [];
    if (!idsToExport.length) return;

    setExporting(true);
    try {
      const details = await Promise.all(idsToExport.map(id => ocrApi.getDocument(id)));

      const masterRows = details.map(d => ({
        'Mã chứng từ':       d.invoiceNumber ?? d.id.slice(0, 12),
        'Loại chứng từ':     TYPE_CONFIG[d.schema.type]?.label ?? d.schema.type,
        'Số hóa đơn':        d.invoiceNumber ?? '',
        'Ngày phát hành':    d.issueDate ? fmtDate(d.issueDate) : '',
        'MST người bán':     d.sellerTaxCode ?? '',
        'Tên người bán':     d.sellerName ?? '',
        'Tổng tiền hàng':    d.totalAmount ?? '',
        'Tiền thuế VAT':     d.vatAmount ?? '',
        'Tổng thanh toán':   d.grandTotal ?? '',
        'Trạng thái':        STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG]?.label ?? d.status,
        'Người tạo':         '',
        'Ngày tạo':          fmtDate(d.createdAt),
      }));

      const lineRows: Record<string, unknown>[] = [];
      for (const d of details) {
        for (const li of d.lineItems) {
          lineRows.push({
            'Mã chứng từ':           d.invoiceNumber ?? d.id.slice(0, 12),
            'STT':                   li.stt,
            'Tên hàng hóa/dịch vụ': li.name ?? '',
            'ĐVT':                   li.unit ?? '',
            'Số lượng':              li.quantity ?? '',
            'Đơn giá':               li.unitPrice ?? '',
            'Thành tiền':            li.amount ?? '',
          });
        }
      }

      const wb = XLSX.utils.book_new();
      const wsMaster = XLSX.utils.json_to_sheet(masterRows);
      const wsLines  = XLSX.utils.json_to_sheet(
        lineRows.length ? lineRows
          : [{ 'Mã chứng từ': '', STT: '', 'Tên hàng hóa/dịch vụ': '', ĐVT: '', 'Số lượng': '', 'Đơn giá': '', 'Thành tiền': '' }],
      );

      wsMaster['!cols'] = [15, 20, 15, 14, 15, 30, 16, 14, 16, 14, 18, 14].map(wch => ({ wch }));
      wsLines['!cols']  = [15, 6, 30, 10, 10, 16, 16].map(wch => ({ wch }));

      XLSX.utils.book_append_sheet(wb, wsMaster, 'Master_Data');
      XLSX.utils.book_append_sheet(wb, wsLines, 'Line_Items');
      XLSX.writeFile(wb, `chung-tu-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Xuất Excel thành công.', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quản lý Chứng từ</h1>
          <p className="text-sm text-gray-500 mt-0.5">Danh sách tất cả chứng từ đã xử lý OCR</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Đang xuất...' : (selectedIds.size > 0 ? `Xuất Excel (${selectedIds.size})` : 'Xuất Excel')}
          </button>
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
                className="flex items-center gap-2 bg-[#0d4f4f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a3d3d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            <StatCard label="Tổng chứng từ"  value={stats.total}       colorClass="text-gray-800"   accentCls="border-l-gray-300"   onClick={() => { setStatusFilter(''); setPage(1); }} />
            <StatCard label="Chờ xác nhận"   value={stats.processed}   colorClass="text-orange-500" accentCls="border-l-orange-400" onClick={() => { setStatusFilter('PROCESSED'); setPage(1); }} />
            <StatCard label="Đã xác nhận"    value={stats.confirmed}   colorClass="text-green-600"  accentCls="border-l-green-400"  onClick={() => { setStatusFilter('CONFIRMED'); setPage(1); }} />
            <StatCard label="Đã chuyển kho"  value={stats.transferred} colorClass="text-purple-600" accentCls="border-l-purple-400" onClick={() => { setStatusFilter('TRANSFERRED'); setPage(1); }} />
            <StatCard label="Lỗi OCR"        value={stats.error}       colorClass="text-red-500"    accentCls="border-l-red-400"    onClick={() => { setStatusFilter('ERROR'); setPage(1); }} />
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-xl border px-4 py-3 flex flex-wrap gap-2.5 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Tìm theo số HĐ, tên file, người bán..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
          </div>
          <div className="w-px h-6 bg-gray-200 shrink-0" />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
            className="h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {/* Date range widget */}
          <div className="flex items-center h-9 border rounded-lg overflow-hidden bg-white shrink-0 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400">
            <span className="pl-2.5 pr-1.5 text-[11px] font-medium text-gray-400 whitespace-nowrap select-none">Từ ngày</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="h-full text-sm bg-transparent border-0 focus:outline-none w-[128px]"
            />
            <span className="px-1.5 text-gray-300 select-none text-sm">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="h-full text-sm bg-transparent border-0 focus:outline-none w-[128px] pr-2"
            />
          </div>
          {(search || statusFilter || typeFilter || dateFrom || dateTo) && (
            <>
              <div className="w-px h-6 bg-gray-200 shrink-0" />
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                className="h-9 px-3 text-sm text-gray-500 hover:text-red-600 border rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Xóa bộ lọc
              </button>
            </>
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
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              <Trash2 className="w-4 h-4" /> Xóa hàng loạt
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
                    <button
                      onClick={() => openDetailPanel(doc.id)}
                      className="flex items-center gap-2 hover:text-blue-600 transition-colors text-left w-full"
                    >
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{doc.fileName ?? doc.schema.name}</span>
                    </button>
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
                        onClick={() => openDetailPanel(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
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
        </div>{/* overflow-x-auto */}
        </div>{/* table card */}

        {/* Pagination */}
        {docs && docs.total > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-gray-400">
              Hiển thị <span className="font-medium text-gray-700">{(docs.page - 1) * 25 + 1}–{Math.min(docs.page * 25, docs.total)}</span> trong tổng số <span className="font-medium text-gray-700">{docs.total.toLocaleString('vi-VN')}</span> chứng từ
            </span>
            {docs.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={docs.page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg min-w-[72px] text-center">
                  {docs.page} / {docs.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(docs.totalPages, p + 1))}
                  disabled={docs.page === docs.totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}
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
                  disabled={editDoc.status === 'CONFIRMED' || editDoc.status === 'TRANSFERRED'}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    editDoc.status === 'CONFIRMED' || editDoc.status === 'TRANSFERRED'
                      ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
                >
                  <option value="PROCESSED">Nháp</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                  {editDoc.status === 'TRANSFERRED' && <option value="TRANSFERRED">Đã chuyển kho</option>}
                </select>
                {(editDoc.status === 'CONFIRMED' || editDoc.status === 'TRANSFERRED') && (
                  <p className="text-xs text-gray-400 mt-1">
                    {editDoc.status === 'TRANSFERRED'
                      ? 'Chứng từ đã chuyển kho không thể thay đổi trạng thái.'
                      : 'Xác nhận rồi → không thể chỉnh sửa trạng thái.'}
                  </p>
                )}
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

      {/* Detail drawer */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Left: document viewer */}
          <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
            {/* Viewer toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 shrink-0">
              <span className="text-xs text-gray-300 truncate max-w-xs">
                {detailDoc?.fileName ?? 'Chứng từ gốc'}
              </span>
              {detailDoc?.mimeType && (
                <a
                  href={ocrApi.getDocumentFileUrl(detailDoc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1 rounded-md transition-colors shrink-0 ml-3"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  Mở rộng
                </a>
              )}
            </div>
            {/* Viewer content */}
            <div className="flex-1 overflow-hidden relative">
              {detailLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
                </div>
              ) : detailDoc?.mimeType?.startsWith('image/') ? (
                <div className="h-full overflow-auto flex items-start justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ocrApi.getDocumentFileUrl(detailDoc.id)}
                    alt={detailDoc.fileName ?? 'document'}
                    className="max-w-full object-contain rounded shadow-lg"
                  />
                </div>
              ) : detailDoc?.mimeType === 'application/pdf' ? (
                <iframe
                  src={ocrApi.getDocumentFileUrl(detailDoc.id)}
                  className="w-full h-full border-0"
                  title={detailDoc.fileName ?? 'document'}
                />
              ) : detailDoc ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                  {(detailDoc.mimeType?.includes('spreadsheetml') || detailDoc.mimeType?.includes('ms-excel') || detailDoc.mimeType === 'text/csv')
                    ? <Table2 className="w-12 h-12 text-green-400" />
                    : detailDoc.mimeType?.includes('wordprocessingml')
                    ? <FileText className="w-12 h-12 text-blue-400" />
                    : <ImageIcon className="w-12 h-12 text-gray-600" />
                  }
                  <p className="text-sm text-center px-6">
                    {(detailDoc.mimeType?.includes('spreadsheetml') || detailDoc.mimeType?.includes('ms-excel') || detailDoc.mimeType === 'text/csv')
                      ? 'File Excel/CSV — AI đã đọc nội dung bảng tính'
                      : detailDoc.mimeType?.includes('wordprocessingml')
                      ? 'File Word — AI đã đọc nội dung văn bản'
                      : 'Không thể xem trước định dạng này'}
                  </p>
                  <a
                    href={ocrApi.getDocumentFileUrl(detailDoc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải file gốc xuống
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-500">Chọn chứng từ để xem</p>
                </div>
              )}
            </div>
          </div>
          {/* Right: detail panel */}
          <div className="w-[480px] shrink-0 bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer header */}
            <div className="px-6 py-4 border-b flex items-start justify-between shrink-0 bg-white">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-gray-900 truncate">
                    {detailDoc?.fileName ?? 'Chi tiết chứng từ'}
                  </h2>
                  {detailDoc && <StatusBadge status={detailDoc.status} />}
                </div>
                {detailDoc && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">{detailDoc.schema.name}</span>
                    <TypeBadge type={detailDoc.schema.type} />
                  </div>
                )}
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0 ml-3"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {detailLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detailDoc ? (
                <div className="p-6 space-y-5">

                  {/* Meta info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { label: 'Mã chứng từ',    value: detailDoc.invoiceNumber },
                      { label: 'Ngày phát hành', value: fmtDate(detailDoc.issueDate) },
                      { label: 'Người bán',      value: detailDoc.sellerName },
                      { label: 'MST người bán',  value: detailDoc.sellerTaxCode },
                      { label: 'Ngày OCR',       value: fmtDate(detailDoc.createdAt) },
                    ] as { label: string; value: string | null | undefined }[])
                      .filter(f => f.value && f.value !== '—')
                      .map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-lg border px-3 py-2.5">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{value}</p>
                        </div>
                      ))}
                  </div>

                  {/* Amounts */}
                  {(detailDoc.totalAmount != null || detailDoc.grandTotal != null) && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-center gap-6 flex-wrap">
                      <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
                      {detailDoc.totalAmount != null && (
                        <div>
                          <p className="text-xs text-blue-500">Chưa thuế</p>
                          <p className="font-mono font-semibold text-gray-800 text-sm">{fmtNum(detailDoc.totalAmount)}</p>
                        </div>
                      )}
                      {detailDoc.vatAmount != null && (
                        <div>
                          <p className="text-xs text-blue-500">VAT</p>
                          <p className="font-mono font-semibold text-gray-800 text-sm">{fmtNum(detailDoc.vatAmount)}</p>
                        </div>
                      )}
                      {detailDoc.grandTotal != null && (
                        <div className="ml-auto">
                          <p className="text-xs text-blue-600 font-medium">Tổng thanh toán</p>
                          <p className="font-mono font-bold text-blue-700 text-base">{fmtNum(detailDoc.grandTotal)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* OCR confidence */}
                  {detailDoc.ocrConfidence != null && (
                    <div className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className="text-xs text-gray-500 shrink-0">Độ tin cậy OCR</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${detailDoc.ocrConfidence > 0.85 ? 'bg-green-500' : detailDoc.ocrConfidence > 0.6 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.round(detailDoc.ocrConfidence * 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${detailDoc.ocrConfidence > 0.85 ? 'text-green-600' : detailDoc.ocrConfidence > 0.6 ? 'text-amber-600' : 'text-red-600'}`}>
                        {Math.round(detailDoc.ocrConfidence * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Error */}
                  {detailDoc.status === 'ERROR' && detailDoc.ocrError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{detailDoc.ocrError}</span>
                    </div>
                  )}

                  {/* Field values */}
                  {detailDoc.values.filter(v => v.stringValue).length > 0 && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b bg-blue-50 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-semibold text-blue-800">Trường dữ liệu</h3>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          {detailDoc.values.filter(v => v.stringValue).length} trường
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {detailDoc.values.filter(v => v.stringValue).map(v => (
                          <div key={v.fieldId} className="flex items-center px-4 py-2.5 gap-3">
                            <span className="text-xs text-gray-500 w-36 shrink-0">{v.field.label}</span>
                            <span className="text-sm text-gray-800 flex-1 truncate">{v.stringValue}</span>
                            {v.confidence != null && (
                              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${v.confidence > 0.85 ? 'text-green-600 bg-green-50' : v.confidence > 0.6 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'}`}>
                                {Math.round(v.confidence * 100)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Line items */}
                  {detailDoc.lineItems.length > 0 && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b bg-orange-50 flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-orange-800">Hàng hóa / Dịch vụ</h3>
                        <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                          {detailDoc.lineItems.length} dòng
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                              <th className="px-3 py-2.5 text-center w-10">STT</th>
                              <th className="px-3 py-2.5 text-left">Tên hàng hóa</th>
                              <th className="px-3 py-2.5 text-center">ĐVT</th>
                              <th className="px-3 py-2.5 text-right">SL</th>
                              <th className="px-3 py-2.5 text-right">Đơn giá</th>
                              <th className="px-3 py-2.5 text-right">Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailDoc.lineItems.map((li, i) => (
                              <tr key={li.stt} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                                <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{li.stt}</td>
                                <td className="px-3 py-2.5 text-gray-800">{li.name ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center text-gray-600 text-xs">{li.unit ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right text-gray-700">{li.quantity ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs">{fmtNum(li.unitPrice)}</td>
                                <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{fmtNum(li.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Audit log */}
                  {detailDoc.auditLogs.length > 0 && (
                    <div className="bg-white border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-700">Lịch sử thay đổi</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {detailDoc.auditLogs.slice(0, 15).map((log, i) => (
                          <div key={i} className="px-4 py-3 flex items-start gap-3">
                            <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap mt-0.5 w-20">
                              {fmtDate(log.changedAt)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-600">{log.changedBy}</span>
                                {log.oldStatus && log.newStatus && (
                                  <div className="flex items-center gap-1">
                                    <StatusBadge status={log.oldStatus} />
                                    <span className="text-gray-400 text-xs">→</span>
                                    <StatusBadge status={log.newStatus} />
                                  </div>
                                )}
                              </div>
                              {log.note && (
                                <p className="text-xs text-gray-400 mt-0.5 italic truncate">{log.note}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Transfer to knowledge warehouse modal */}
      {transferOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                transferIds.length > 0 ? 'bg-teal-50' : 'bg-orange-50'
              }`}>
                <Database className={`w-6 h-6 ${transferIds.length > 0 ? 'text-teal-600' : 'text-orange-400'}`} />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                Chuyển vào kho tri thức
              </h2>
              {transferIds.length > 0 ? (
                <p className="text-sm text-gray-500">
                  Chuyển{' '}
                  <span className="font-semibold text-gray-800">{transferIds.length}</span>{' '}
                  chứng từ <span className="text-green-600 font-medium">đã xác nhận</span> vào kho tri thức?
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Không có chứng từ nào ở trạng thái{' '}
                  <span className="font-medium text-green-600">"Đã xác nhận"</span>{' '}
                  trong lựa chọn hiện tại.
                  <br />
                  <span className="text-xs text-gray-400 mt-1 block">Vui lòng xác nhận chứng từ trước khi chuyển kho.</span>
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-center gap-3">
              <button
                onClick={() => setTransferOpen(false)}
                disabled={transferring}
                className="px-6 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {transferIds.length > 0 ? 'Hủy' : 'Đóng'}
              </button>
              {transferIds.length > 0 && (
                <button
                  onClick={handleTransfer}
                  disabled={transferring}
                  className="px-6 py-2 text-sm font-medium bg-[#0d4f4f] text-white rounded-lg hover:bg-[#0a3d3d] disabled:opacity-50"
                >
                  {transferring ? 'Đang chuyển...' : 'Chuyển'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmDialog.confirmCls}`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-2xl border max-w-sm text-sm font-medium animate-in slide-in-from-bottom-2 duration-200 ${
          toast.type === 'error'
            ? 'bg-white text-red-700 border-red-200 shadow-red-100'
            : 'bg-white text-green-700 border-green-200 shadow-green-100'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'error' ? 'bg-red-50' : 'bg-green-50'}`}>
            {toast.type === 'error'
              ? <AlertCircle className="w-4 h-4 text-red-500" />
              : <Check className="w-4 h-4 text-green-500" />}
          </div>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 text-gray-300 hover:text-gray-500 shrink-0 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
