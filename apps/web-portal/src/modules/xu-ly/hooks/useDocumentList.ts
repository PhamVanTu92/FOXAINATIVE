'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocListItem, DocStats } from '@/lib/ocr-api';
import * as XLSX from 'xlsx';
import { TYPE_CONFIG, STATUS_CONFIG_FULL, STANDARD_COLUMNS, STANDARD_FIELD_KEYS, fmtDate } from '../constants';

interface ConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  confirmCls: string;
  onConfirm: () => void;
}

interface ToastState {
  message: string;
  type: 'error' | 'success';
}

type DocsResult = { items: DocListItem[]; total: number; totalPages: number; page: number };

export function useDocumentList() {
  const [stats, setStats]       = useState<DocStats | null>(null);
  const [docs, setDocs]         = useState<DocsResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [sellerTaxCode, setSellerTaxCode] = useState('');
  const [exporting, setExporting]       = useState(false);
  const [page, setPage]                 = useState(1);

  const [editDoc, setEditDoc]       = useState<DocListItem | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [transferOpen, setTransferOpen]       = useState(false);
  const [transferIds, setTransferIds]         = useState<string[]>([]);
  const [transferring, setTransferring]       = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [toast, setToast]                 = useState<ToastState | null>(null);
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
      if (search)        params.search        = search;
      // Mặc định ẩn PROCESSED (OCR xong nhưng chưa được user lưu); chỉ hiện khi user tự chọn filter
      params.status = statusFilter || ['DRAFT', 'CONFIRMED', 'TRANSFERRED', 'ERROR'];
      if (typeFilter)    params.type          = typeFilter;
      if (dateFrom)      params.dateFrom      = dateFrom;
      if (dateTo)        params.dateTo        = dateTo;
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
      const STANDARD_KEYS = STANDARD_FIELD_KEYS;

      const masterRows = details.map(d => {
        const row: Record<string, unknown> = {
          'Tên file':   d.fileName ?? '',
          'Schema':     d.schema.name,
          'Loại':       TYPE_CONFIG[d.schema.type]?.label ?? d.schema.type,
          'Trạng thái': STATUS_CONFIG_FULL[d.status as keyof typeof STATUS_CONFIG_FULL]?.label ?? d.status,
          'Ngày tạo':   fmtDate(d.createdAt),
        };
        for (const v of d.values.filter(v => v.stringValue)) {
          row[v.field.label] = v.stringValue ?? '';
        }
        return row;
      });

      const tableSheets = new Map<string, Record<string, unknown>[]>();

      for (const d of details) {
        if (d.lineItems.length === 0) continue;
        const docRef = d.fileName ?? d.id.slice(0, 12);

        if (d.schema.tables.length > 0) {
          for (const table of d.schema.tables) {
            const tableLineItems = d.lineItems.filter(li => !li.tableKey || li.tableKey === table.tableKey);
            if (tableLineItems.length === 0) continue;

            const columns = table.columns.length > 0
              ? table.columns.map(c => ({ columnKey: c.columnKey, label: c.label }))
              : STANDARD_COLUMNS.map(c => ({ columnKey: c.key, label: c.key }));

            const sheetName = table.name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
            if (!tableSheets.has(sheetName)) tableSheets.set(sheetName, []);

            for (const li of tableLineItems) {
              const row: Record<string, unknown> = { 'Tên file': docRef, 'STT': li.stt };
              for (const col of columns) {
                const raw = STANDARD_KEYS.has(col.columnKey)
                  ? li[col.columnKey as keyof typeof li]
                  : li.extraData?.[col.columnKey];
                row[col.label] = raw != null ? raw : '';
              }
              tableSheets.get(sheetName)!.push(row);
            }
          }
        } else {
          const sheetName = 'Hàng hóa';
          if (!tableSheets.has(sheetName)) tableSheets.set(sheetName, []);
          for (const li of d.lineItems) {
            const row: Record<string, unknown> = { 'Tên file': docRef, 'STT': li.stt };
            const extraKeys = li.extraData ? Object.keys(li.extraData) : [];
            if (extraKeys.length > 0) {
              for (const k of extraKeys) row[k] = li.extraData?.[k] ?? '';
            } else {
              for (const c of STANDARD_COLUMNS) row[c.key] = li[c.key as keyof typeof li] ?? '';
            }
            tableSheets.get(sheetName)!.push(row);
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masterRows.length ? masterRows : [{}]), 'Dữ liệu');
      for (const [sheetName, rows] of tableSheets) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), sheetName);
      }

      XLSX.writeFile(wb, `chung-tu-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Xuất Excel thành công.', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return {
    stats, docs, loading, pageError, selectedIds, setSelectedIds,
    search, setSearch, statusFilter, setStatusFilter, typeFilter, setTypeFilter,
    dateFrom, setDateFrom, dateTo, setDateTo, sellerTaxCode, setSellerTaxCode,
    exporting, page, setPage,
    editDoc, setEditDoc, editStatus, setEditStatus, editSaving,
    transferOpen, setTransferOpen, transferIds, transferring, loadingTransfer,
    confirmDialog, setConfirmDialog,
    toast, setToast, showToast,
    loadStats, loadDocs, toggleSelect, toggleAll,
    handleBulkConfirm, handleBulkDelete,
    openTransferModal, openTransferAllConfirmed, handleTransfer,
    deleteDoc, openEditModal, handleSaveEdit, handleExportExcel,
  };
}
