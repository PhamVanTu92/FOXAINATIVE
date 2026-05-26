'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocDetail, DocListItem, DocStats, SchemaListItem, LineItem } from '@/lib/ocr-api';

type DocsResult = { items: DocListItem[]; total: number; totalPages: number; page: number };

export function useInvoiceList() {
  const [stats, setStats]             = useState<DocStats | null>(null);
  const [docs, setDocs]               = useState<DocsResult | null>(null);
  const [schemas, setSchemas]         = useState<SchemaListItem[]>([]);
  const [loading, setLoading]         = useState(false);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'info' | 'lines' | 'audit'>('info');

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [page, setPage]                 = useState(1);

  const [uploadFile, setUploadFile]         = useState<File | null>(null);
  const [uploadSchemaId, setUploadSchemaId] = useState('');
  const [uploadLanguage, setUploadLanguage] = useState<'vi' | 'en' | 'vi+en'>('vi');
  const [uploadLoading, setUploadLoading]   = useState(false);
  const [uploadMsg, setUploadMsg]           = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editValues, setEditValues]       = useState<Record<string, string>>({});
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);
  const [editDirty, setEditDirty]         = useState(false);
  const [saveLoading, setSaveLoading]     = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try { setStats(await ocrApi.getStats()); } catch { /* silent */ }
  }, []);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: Record<string, string | string[]> = {
        page: String(page), pageSize: '20', type: 'INVOICE',
      };
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom)     params.dateFrom = dateFrom;
      if (dateTo)       params.dateTo = dateTo;
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

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    if (!docs) return;
    const all = docs.items.map(d => d.id);
    setSelectedIds(prev => prev.size === all.length ? new Set() : new Set(all));
  };

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

  const closeUpload = () => { setUploadOpen(false); setUploadFile(null); setUploadMsg(null); };

  return {
    stats, docs, schemas, loading, pageError,
    selectedDoc, setSelectedDoc, detailLoading, selectedIds,
    uploadOpen, setUploadOpen, activeTab, setActiveTab,
    search, setSearch, statusFilter, setStatusFilter,
    dateFrom, setDateFrom, dateTo, setDateTo, page, setPage,
    uploadFile, setUploadFile, uploadSchemaId, setUploadSchemaId,
    uploadLanguage, setUploadLanguage, uploadLoading, uploadMsg, fileInputRef,
    editValues, setEditValues, editLineItems, editDirty, setEditDirty, saveLoading, confirmLoading,
    setSelectedIds,
    loadStats, loadDocs, openDetail, toggleSelect, toggleAll,
    bulkConfirm, bulkDelete, handleUpload, saveEdits, confirmDoc, deleteDoc,
    addLineItem, removeLineItem, updateLi, closeUpload,
  };
}
