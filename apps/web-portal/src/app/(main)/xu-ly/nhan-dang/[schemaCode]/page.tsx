'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, X, AlertCircle, AlertTriangle, Check, Save, ScanLine,
  FileText, Plus, Minus, ChevronRight, Download,
  Loader2, Table2, Grid3X3, Sparkles, Image as ImageIcon, Bot, Clock,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaDetail, DocDetail, DataType, LineItem, SseEvent } from '@/lib/ocr-api';

// ─── Types ────────────────────────────────────────────────────────────────────

type QueueStatus = 'uploading' | 'queued' | 'processing' | 'done' | 'error';

interface QueueItem {
  localId: string;
  files: File[];          // All source files for this document
  status: QueueStatus;
  documentId?: string;
  doc?: DocDetail;
  fieldValues: Record<string, string>;
  lineItems: LineItem[];
  dirty: boolean;
  errorMsg?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATA_TYPE_LABEL: Record<DataType, string> = {
  TEXT: 'Text', DATE: 'Date', NUMBER: 'Number',
  CURRENCY: 'Currency', BOOLEAN: 'Boolean', LIST: 'List',
};

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(n);
}

function ConfBadge({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-gray-300 text-xs">—</span>;
  const pct = Math.round(v * 100);
  const cls = v > 0.85 ? 'text-green-600 bg-green-50' : v > 0.6 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{pct}%</span>;
}

function QueueStatusBadge({ status }: { status: QueueStatus }) {
  if (status === 'uploading')  return <span className="flex items-center gap-1 text-xs text-blue-600"><Loader2 className="w-3 h-3 animate-spin" />Đang tải</span>;
  if (status === 'queued')     return <span className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3 h-3" />Chờ quét</span>;
  if (status === 'processing') return <span className="flex items-center gap-1 text-xs text-blue-600"><Loader2 className="w-3 h-3 animate-spin" />Đang quét</span>;
  if (status === 'done')       return <span className="flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />Hoàn tất</span>;
  return                              <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />Lỗi</span>;
}

const STATUS_CONFIG = {
  DRAFT:       { label: 'Nháp',          cls: 'bg-gray-100  text-gray-700  border-gray-200' },
  PROCESSED:   { label: 'Đã xử lý',      cls: 'bg-blue-50   text-blue-700  border-blue-200' },
  CONFIRMED:   { label: 'Đã xác nhận',   cls: 'bg-green-50  text-green-700 border-green-200' },
  TRANSFERRED: { label: 'Đã chuyển kho', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  ERROR:       { label: 'Lỗi OCR',       cls: 'bg-red-50    text-red-700   border-red-200' },
} as const;

const TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Hóa đơn VAT', RECEIPT: 'Hóa đơn bán lẻ', CONTRACT: 'Hợp đồng',
  STATEMENT: 'Bảng kê', MINUTES: 'Biên bản', WAREHOUSE_RECEIPT: 'Phiếu nhập kho', OTHERS: 'Khác',
};

const STANDARD_FIELD_KEYS = new Set(['name', 'unit', 'quantity', 'unitPrice', 'amount']);
const NUMERIC_FIELD_KEYS  = new Set(['quantity', 'unitPrice', 'amount']);

function getFileIcon(fileName: string): { Icon: React.ComponentType<{ className?: string }>; color: string; label: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls'].includes(ext)) return { Icon: Table2,    color: 'text-green-500',  label: 'Excel' };
  if (ext === 'csv')                  return { Icon: Table2,    color: 'text-teal-500',   label: 'CSV' };
  if (ext === 'docx')                 return { Icon: FileText,  color: 'text-blue-500',   label: 'Word' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'tif'].includes(ext))
                                      return { Icon: ImageIcon, color: 'text-purple-500', label: 'Ảnh' };
  return                                     { Icon: FileText,  color: 'text-red-400',    label: 'PDF' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NhanDangOCRPage({ params }: { params: { schemaCode: string } }) {
  const router = useRouter();
  const { schemaCode } = params;

  const [schema, setSchema]             = useState<SchemaDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError]   = useState<string | null>(null);

  const [ocrProvider, setOcrProvider]   = useState<string>('gemini');
  const [dragging, setDragging]         = useState(false);
  const [queue, setQueue]               = useState<QueueItem[]>([]);
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [focusedCellKey, setFocusedCellKey] = useState<string | null>(null);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // ── Derived from active item ────────────────────────────────────────────────
  const activeItem  = queue.find(q => q.localId === activeId) ?? null;
  const doc         = activeItem?.doc ?? null;
  const fieldValues = activeItem?.fieldValues ?? {};
  const lineItems   = activeItem?.lineItems ?? [];
  const dirty       = activeItem?.dirty ?? false;
  const isUploading = activeItem?.status === 'uploading';
  const isPolling   = activeItem?.status === 'queued' || activeItem?.status === 'processing';
  const isProcessing = isUploading || isPolling;

  useEffect(() => {
    ocrApi.getSchemaByCode(schemaCode)
      .then(s => setSchema(s))
      .catch(e => setSchemaError((e as Error).message))
      .finally(() => setSchemaLoading(false));
  }, [schemaCode]);

  // Cleanup all SSE on unmount
  useEffect(() => () => { eventSourcesRef.current.forEach(es => es.close()); }, []);

  // ── Queue helpers ──────────────────────────────────────────────────────────

  const updateItem = useCallback((localId: string, patch: Partial<QueueItem>) => {
    setQueue(prev => prev.map(q => q.localId === localId ? { ...q, ...patch } : q));
  }, []);

  const removeItem = useCallback((localId: string) => {
    const es = eventSourcesRef.current.get(localId);
    if (es) { es.close(); eventSourcesRef.current.delete(localId); }
    setQueue(prev => prev.filter(q => q.localId !== localId));
    setActiveId(prev => prev === localId ? null : prev);
  }, []);

  // ── SSE per item ───────────────────────────────────────────────────────────

  const startSSE = useCallback((localId: string, docId: string) => {
    const es = new EventSource(ocrApi.getDocumentSseUrl(docId));
    eventSourcesRef.current.set(localId, es);

    es.onmessage = (event: MessageEvent<string>) => {
      let data: SseEvent;
      try { data = JSON.parse(event.data) as SseEvent; } catch { return; }

      if (data.type === 'done') {
        es.close();
        eventSourcesRef.current.delete(localId);
        const vals: Record<string, string> = {};
        for (const v of data.document.values) vals[v.fieldId] = v.stringValue ?? '';
        updateItem(localId, {
          status: 'done', doc: data.document,
          fieldValues: vals, lineItems: [...data.document.lineItems], dirty: false,
        });
        // Auto-select first completed item if nothing active
        setActiveId(prev => prev ?? localId);
      } else if (data.type === 'failed') {
        es.close();
        eventSourcesRef.current.delete(localId);
        updateItem(localId, { status: 'error', errorMsg: data.error });
      } else if (data.type === 'progress') {
        updateItem(localId, { status: 'processing' });
      }
    };

    es.onerror = () => {
      es.close();
      eventSourcesRef.current.delete(localId);
      updateItem(localId, { status: 'error', errorMsg: 'Mất kết nối khi theo dõi tiến trình OCR.' });
    };
  }, [updateItem]);

  // ── OCR per item (all files → one document) ────────────────────────────────

  const triggerOCR = useCallback(async (localId: string, files: File[], s: SchemaDetail, provider: string) => {
    try {
      const res = await ocrApi.uploadDocument(files, s.id, 'vi+en', provider);
      updateItem(localId, { status: 'queued', documentId: res.documentId });
      startSSE(localId, res.documentId);
    } catch (e: unknown) {
      updateItem(localId, { status: 'error', errorMsg: (e as Error).message });
    }
  }, [updateItem, startSSE]);

  // ── Accept files — ALL files from one selection/drop → ONE document ────────

  const acceptFiles = useCallback((files: File[]) => {
    if (!schema || files.length === 0) return;
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newItem: QueueItem = {
      localId, files, status: 'uploading',
      fieldValues: {}, lineItems: [], dirty: false,
    };
    setQueue(prev => [...prev, newItem]);
    setActiveId(prev => prev ?? localId);
    triggerOCR(localId, files, schema, ocrProvider);
  }, [schema, ocrProvider, triggerOCR]);

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) acceptFiles(files);
  };

  // ── Edit helpers (operate on active item) ─────────────────────────────────

  const setFieldValue = useCallback((fieldId: string, value: string) => {
    if (!activeId) return;
    setQueue(prev => prev.map(q =>
      q.localId === activeId ? { ...q, fieldValues: { ...q.fieldValues, [fieldId]: value }, dirty: true } : q,
    ));
  }, [activeId]);

  const setLineItemsForActive = useCallback((updater: (prev: LineItem[]) => LineItem[]) => {
    if (!activeId) return;
    setQueue(prev => prev.map(q =>
      q.localId === activeId ? { ...q, lineItems: updater(q.lineItems), dirty: true } : q,
    ));
  }, [activeId]);

  const addLineItem = (tableKey?: string) => {
    setLineItemsForActive(prev => {
      const stt = prev.length ? Math.max(...prev.map(li => li.stt)) + 1 : 1;
      return [...prev, { id: '', stt, tableKey: tableKey ?? null, name: '', unit: '', quantity: null, unitPrice: null, amount: null, isManuallyAdded: true }];
    });
  };

  const removeLineItem = (stt: number) => setLineItemsForActive(prev => prev.filter(li => li.stt !== stt));

  const updateLi = <K extends keyof LineItem>(stt: number, key: K, value: LineItem[K]) =>
    setLineItemsForActive(prev => prev.map(li => li.stt === stt ? { ...li, [key]: value } : li));

  const updateLiExtra = (stt: number, colKey: string, value: string) =>
    setLineItemsForActive(prev => prev.map(li =>
      li.stt === stt ? { ...li, extraData: { ...(li.extraData ?? {}), [colKey]: value } } : li,
    ));

  // ── Save / Confirm ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!doc || !activeId) return;
    setSaving(true);
    try {
      const updated = await ocrApi.updateDocument(doc.id, {
        values: Object.entries(fieldValues).map(([fieldId, stringValue]) => ({ fieldId, stringValue })),
        lineItems: lineItems.map(({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData }) =>
          ({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData })),
      });
      updateItem(activeId, { doc: updated, dirty: false });
    } catch (e: unknown) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSaveAndExit = async () => {
    if (!doc || !activeId) return;
    setConfirming(true);
    try {
      if (dirty) {
        const updated = await ocrApi.updateDocument(doc.id, {
          values: Object.entries(fieldValues).map(([fieldId, stringValue]) => ({ fieldId, stringValue })),
          lineItems: lineItems.map(({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData }) =>
            ({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData })),
        });
        updateItem(activeId, { doc: updated, dirty: false });
      }
      router.push('/xu-ly/chung-tu');
    } catch (e: unknown) { console.error(e); }
    finally { setConfirming(false); }
  };

  const handleExport = () => {
    if (!doc || !schema) return;
    const rows = schema.fields.map(f => ({ field: f.label, key: f.fieldKey, value: fieldValues[f.id] ?? '' }));
    const blob = new Blob([JSON.stringify({ schema: schema.code, fields: rows, lineItems }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `${schema.code}-${doc.id.slice(0, 8)}.json` }).click();
    URL.revokeObjectURL(url);
  };

  // ─── Arithmetic validation ────────────────────────────────────────────────

  const arithmeticWarnings = useMemo(() => {
    const w = { lineItems: new Set<number>(), fields: new Set<string>() };
    if (!doc || !schema || isProcessing) return w;
    for (const li of lineItems) {
      if (li.quantity != null && li.unitPrice != null && li.amount != null) {
        if (Math.abs(li.quantity * li.unitPrice - li.amount) > 1) w.lineItems.add(li.stt);
      }
    }
    const fid = (key: string) => schema.fields.find(f => f.fieldKey === key)?.id;
    const fTotal = fid('totalAmount'); const fVat = fid('vatAmount'); const fGrand = fid('grandTotal');
    const parseNum = (id: string | undefined) => {
      if (!id) return null;
      const n = parseFloat((fieldValues[id] ?? '').replace(/[^\d.-]/g, ''));
      return isNaN(n) ? null : n;
    };
    const total = parseNum(fTotal); const vat = parseNum(fVat); const grand = parseNum(fGrand);
    if (fTotal && total != null && lineItems.length > 0) {
      const sum = lineItems.reduce((acc, li) => acc + (li.amount ?? 0), 0);
      if (Math.abs(sum - total) > 1) w.fields.add(fTotal);
    }
    if (total != null && vat != null && grand != null && Math.abs(total + vat - grand) > 1) {
      if (fTotal) w.fields.add(fTotal); if (fVat) w.fields.add(fVat); if (fGrand) w.fields.add(fGrand);
    }
    return w;
  }, [doc, schema, lineItems, fieldValues, isProcessing]);

  const hasArithmeticWarnings = arithmeticWarnings.lineItems.size > 0 || arithmeticWarnings.fields.size > 0;

  // ─── Loading screens ──────────────────────────────────────────────────────

  if (schemaLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  if (schemaError || !schema) return (
    <div className="p-8">
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm max-w-lg">
        <AlertCircle className="w-4 h-4 shrink-0" /> {schemaError ?? 'Không tìm thấy schema.'}
      </div>
      <button onClick={() => router.back()} className="mt-3 text-sm text-blue-600 hover:underline">← Quay lại</button>
    </div>
  );

  const docStatus    = doc ? STATUS_CONFIG[doc.status] : null;
  const isConfirmed  = doc?.status === 'CONFIRMED';
  const confPct      = doc?.ocrConfidence != null ? Math.round(doc.ocrConfidence * 100) : null;
  const confColor    = confPct == null ? '' : confPct > 85 ? 'bg-green-500' : confPct > 60 ? 'bg-amber-400' : 'bg-red-400';
  const confTextColor = confPct == null ? '' : confPct > 85 ? 'text-green-600' : confPct > 60 ? 'text-amber-600' : 'text-red-600';
  const anyProcessing = queue.some(q => q.status === 'uploading' || q.status === 'queued' || q.status === 'processing');

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-100">

      {/* ── Page header ── */}
      <div className="bg-white border-b px-6 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
          <ScanLine className="w-3.5 h-3.5" />
          <span>Nhận dạng OCR</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium">{schema.name}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{schema.name}</h1>
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">[{schema.code}]</span>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              {TYPE_LABEL[schema.type] ?? schema.type}
            </span>
            {docStatus && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${docStatus.cls}`}>
                {docStatus.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doc && (
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-3.5 h-3.5" /> Xuất JSON
              </button>
            )}
            {doc && !isConfirmed && dirty && (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-700 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            )}
            {doc && !isConfirmed && (
              <button onClick={handleSaveAndExit} disabled={confirming || saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />
                {confirming ? 'Đang lưu...' : 'Lưu chứng từ'}
              </button>
            )}
            {isConfirmed && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
                <Check className="w-4 h-4" /> Đã xác nhận
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Arithmetic warning banner ── */}
      {hasArithmeticWarnings && !isProcessing && doc && (
        <div className="mx-4 mt-3 shrink-0 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold">Cảnh báo số học — </span>
            {arithmeticWarnings.lineItems.size > 0 && (
              <span>{arithmeticWarnings.lineItems.size} dòng có Thành tiền ≠ SL × Đơn giá. </span>
            )}
            {arithmeticWarnings.fields.size > 0 && (
              <span>Tổng tiền hàng + Thuế VAT ≠ Tổng thanh toán. </span>
            )}
            <span className="text-amber-600 text-xs">Kiểm tra các ô được tô vàng trước khi xác nhận.</span>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">

        {/* ── Upload card ── */}
        <div className="shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full cursor-pointer transition-all ${dragging ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff,.docx,.xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) acceptFiles(files);
                e.target.value = '';
              }}
            />
            <div className="flex flex-col items-center justify-center py-7 gap-1.5">
              <Upload className={`w-8 h-8 mb-1 ${dragging ? 'text-blue-500' : 'text-blue-300'}`} />
              <p className="text-sm font-semibold text-gray-700">
                {dragging ? 'Thả tệp vào đây...' : 'Kéo thả hoặc click để chọn nhiều tệp'}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap justify-center">
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-red-400" /> PDF</span>
                <span className="text-gray-200">·</span>
                <span className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5 text-purple-400" /> PNG · JPG · TIFF</span>
                <span className="text-gray-200">·</span>
                <span className="flex items-center gap-1"><Table2 className="w-3.5 h-3.5 text-green-500" /> Excel · CSV</span>
                <span className="text-gray-200">·</span>
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-blue-500" /> Word</span>
              </div>
              <p className="text-xs text-blue-500 mt-1 flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5" /> Có thể chọn nhiều tệp cùng lúc
              </p>
            </div>
          </div>

          {/* Model selector */}
          <div className="border-t px-5 py-2.5 flex items-center gap-3 bg-gray-50">
            <Bot className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 font-medium shrink-0">Model AI</span>
            <select
              value={ocrProvider}
              onChange={e => setOcrProvider(e.target.value)}
              disabled={anyProcessing}
              className="text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="gemini">Gemini 2.5 Flash</option>
              <option value="claude">Claude Sonnet 4.5</option>
            </select>
            {queue.length > 0 && (
              <span className="ml-auto text-xs text-gray-400">
                {queue.filter(q => q.status === 'done').length}/{queue.length} chứng từ hoàn tất
              </span>
            )}
          </div>

          {/* Queue list */}
          {queue.length > 0 && (
            <div className="border-t divide-y divide-gray-100">
              {queue.map(item => {
                const primaryFile = item.files[0]!;
                const { Icon: FIcon, color: fColor } = getFileIcon(primaryFile.name);
                const isActive = activeId === item.localId;
                const totalSize = item.files.reduce((s, f) => s + f.size, 0);
                return (
                  <div key={item.localId} className={`transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <div
                      onClick={() => item.status === 'done' && setActiveId(item.localId)}
                      className={`flex items-center gap-3 px-5 py-2.5 ${item.status === 'done' ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {isActive && <div className="w-0.5 h-8 bg-blue-500 rounded-full -ml-1 shrink-0" />}
                      <FIcon className={`w-4 h-4 shrink-0 ${fColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {primaryFile.name}
                          {item.files.length > 1 && (
                            <span className="ml-1.5 text-xs text-blue-500 font-normal">+{item.files.length - 1} tệp</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.files.length > 1 ? `${item.files.length} tệp · ` : ''}{(totalSize / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <QueueStatusBadge status={item.status} />
                      {item.status === 'done' && <ConfBadge v={item.doc?.ocrConfidence} />}
                      {item.status === 'error' && (
                        <span className="text-xs text-red-400 max-w-[160px] truncate" title={item.errorMsg}>
                          {item.errorMsg}
                        </span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); removeItem(item.localId); }}
                        className="p-1 text-gray-300 hover:text-red-400 shrink-0 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Show sub-file list when multiple files */}
                    {item.files.length > 1 && isActive && (
                      <div className="pb-2 pl-14 pr-5 space-y-1">
                        {item.files.map((f, fi) => {
                          const { Icon: SI, color: sc } = getFileIcon(f.name);
                          return (
                            <div key={fi} className="flex items-center gap-2 text-xs text-gray-500">
                              <SI className={`w-3.5 h-3.5 shrink-0 ${sc}`} />
                              <span className="truncate">{f.name}</span>
                              <span className="text-gray-300 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats bar — shows after OCR of active item */}
          {doc && !isProcessing && (
            <div className="border-t px-6 py-3 flex items-center gap-8 bg-slate-50 flex-wrap">
              {confPct != null && (
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-medium text-gray-500">Độ tin cậy</span>
                  <span className={`text-sm font-bold ${confTextColor}`}>{confPct}%</span>
                  <div className="bg-gray-200 rounded-full h-2 w-24">
                    <div className={`h-2 rounded-full transition-all ${confColor}`} style={{ width: `${confPct}%` }} />
                  </div>
                </div>
              )}
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-500">Trường:</span>
                <span className="font-semibold text-gray-800">{doc.values.filter(v => v.stringValue).length}/{schema.fields.length}</span>
              </div>
              {lineItems.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-gray-500">Hàng hóa:</span>
                  <span className="font-semibold text-gray-800">{lineItems.length} dòng</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Fields ── */}
        <div className="shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-blue-50">
              <div className="flex items-center gap-2.5">
                <Grid3X3 className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-blue-800">Trường dữ liệu</h2>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                  {schema.fields.length} trường
                </span>
              </div>
              {doc?.ocrConfidence != null && (
                <div className="flex items-center gap-1.5 text-xs text-blue-700">
                  <span>Độ chính xác:</span>
                  <span className={`font-bold ${confTextColor}`}>{confPct}%</span>
                </div>
              )}
            </div>

            {schema.fields.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">Schema này chưa có trường OCR nào.</div>
            ) : (
              <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
                {schema.fields.map(f => {
                  const docValue = doc?.values.find(v => v.fieldId === f.id);
                  const hasValue = !!(docValue?.stringValue);
                  return (
                    <div key={f.id} className="bg-white px-5 py-4 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{f.label}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <code className="text-xs text-gray-400 font-mono">{f.fieldKey}</code>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{DATA_TYPE_LABEL[f.dataType]}</span>
                          </div>
                        </div>
                        <div className="shrink-0 ml-2 mt-0.5">
                          {isProcessing
                            ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse" />
                            : <ConfBadge v={docValue?.confidence} />
                          }
                        </div>
                      </div>
                      {isProcessing ? (
                        <div className="h-9 bg-gray-100 rounded-lg animate-pulse w-full" />
                      ) : doc && !isConfirmed ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={fieldValues[f.id] ?? ''}
                            onChange={e => setFieldValue(f.id, e.target.value)}
                            placeholder={`Nhập ${f.label.toLowerCase()}...`}
                            className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
                              arithmeticWarnings.fields.has(f.id)
                                ? 'border-amber-400 bg-amber-50 text-gray-900 focus:ring-amber-300'
                                : hasValue
                                  ? 'border-green-300 bg-green-50 text-gray-900 focus:ring-blue-400'
                                  : 'border-gray-300 bg-gray-50 text-gray-600 placeholder:text-gray-400 focus:ring-blue-400'
                            }`}
                          />
                          {docValue?.isManuallyEdited && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-medium">Đã sửa</span>
                          )}
                        </div>
                      ) : isConfirmed ? (
                        <p className="text-sm text-gray-800 font-medium px-1 py-2 min-h-[36px]">{fieldValues[f.id] || '—'}</p>
                      ) : (
                        <div className="h-9 rounded-lg border border-dashed border-gray-200 bg-gray-50" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Tables ── */}
        <div className="shrink-0 space-y-4">
          {schema.tables.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-center">
              <Table2 className="w-8 h-8 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Schema này chưa có bảng dữ liệu</p>
            </div>
          ) : schema.tables.map(table => {
            const useSchemaColumns = table.columns.length > 0;
            const tableLineItems = lineItems.filter(li => !li.tableKey || li.tableKey === table.tableKey);
            const colCount = useSchemaColumns ? table.columns.length : 0;
            return (
              <div key={table.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b bg-orange-50">
                  <div className="flex items-center gap-2.5">
                    <Table2 className="w-4 h-4 text-orange-500" />
                    <h2 className="text-sm font-semibold text-orange-800">{table.name}</h2>
                    {tableLineItems.length > 0 && (
                      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                        {tableLineItems.length} dòng
                      </span>
                    )}
                  </div>
                  {doc && !isConfirmed && useSchemaColumns && (
                    <button
                      onClick={() => addLineItem(table.tableKey)}
                      className="flex items-center gap-1.5 text-xs text-orange-700 bg-white border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm dòng
                    </button>
                  )}
                </div>

                {!useSchemaColumns ? (
                  <div className="px-5 py-4 text-sm text-gray-500 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    Bảng này chưa có cột nào được cấu hình trong schema.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-100 text-gray-600 uppercase tracking-wide font-semibold text-xs">
                          <th className="px-3 py-2.5 text-center w-10">STT</th>
                          {table.columns.map(col => (
                            <th key={col.id} className={`px-3 py-2.5 ${NUMERIC_FIELD_KEYS.has(col.columnKey) || col.dataType === 'NUMBER' || col.dataType === 'CURRENCY' ? 'text-right' : 'text-left'}`}>{col.label}</th>
                          ))}
                          {doc && !isConfirmed && <th className="w-8" />}
                        </tr>
                      </thead>
                      <tbody>
                        {isProcessing ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} className="border-b">
                              <td className="px-4 py-3 text-center"><div className="h-4 bg-gray-100 rounded animate-pulse w-6 mx-auto" /></td>
                              {Array.from({ length: colCount }).map((_, j) => (
                                <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                              ))}
                            </tr>
                          ))
                        ) : tableLineItems.length > 0 ? (
                          tableLineItems.map((li, liIdx) => (
                            <tr key={li.stt} className={`border-b last:border-0 hover:bg-blue-50/20 ${liIdx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                              <td className="px-4 py-3 text-center text-sm font-medium text-gray-500">{li.stt}</td>
                              {table.columns.map(col => {
                                const isStandard = STANDARD_FIELD_KEYS.has(col.columnKey);
                                const isNumeric = NUMERIC_FIELD_KEYS.has(col.columnKey) || col.dataType === 'NUMBER' || col.dataType === 'CURRENCY';
                                const raw = isStandard ? li[col.columnKey as keyof typeof li] : li.extraData?.[col.columnKey];
                                const rawStr = raw != null ? String(raw) : '';
                                const cellKey = `${li.stt}_${col.columnKey}`;
                                const isFocused = focusedCellKey === cellKey;
                                const displayVal = isNumeric && rawStr !== '' && !isFocused
                                  ? new Intl.NumberFormat('vi-VN').format(Number(rawStr)) : rawStr;
                                const isAmountWarning = col.columnKey === 'amount' && arithmeticWarnings.lineItems.has(li.stt);
                                const handleChange = (val: string) => {
                                  if (isStandard && isNumeric) updateLi(li.stt, col.columnKey as 'quantity' | 'unitPrice' | 'amount', val ? Number(val) : null);
                                  else if (isStandard) updateLi(li.stt, col.columnKey as 'name' | 'unit', val);
                                  else updateLiExtra(li.stt, col.columnKey, isNumeric ? (val ? val : '') : val);
                                };
                                return (
                                  <td key={col.columnKey} className={`px-4 py-3${isAmountWarning ? ' bg-amber-50' : ''}`}>
                                    <input
                                      type={isNumeric && isFocused ? 'number' : 'text'}
                                      value={displayVal}
                                      onChange={e => handleChange(e.target.value)}
                                      onFocus={() => setFocusedCellKey(cellKey)}
                                      onBlur={() => setFocusedCellKey(null)}
                                      disabled={isConfirmed}
                                      className={`w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded px-1.5 py-1 disabled:text-gray-700 text-sm${isNumeric ? ' text-right font-mono' : ' text-gray-900'}${isAmountWarning ? ' text-amber-600 font-semibold' : ''}`}
                                    />
                                    {isAmountWarning && (
                                      <span className="text-amber-400 text-xs" title={`Kỳ vọng: ${li.quantity != null && li.unitPrice != null ? fmt(Math.round(li.quantity * li.unitPrice)) : '?'}`}>⚠</span>
                                    )}
                                  </td>
                                );
                              })}
                              {!isConfirmed && (
                                <td className="px-2 py-3">
                                  <button onClick={() => removeLineItem(li.stt)} className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors">
                                    <Minus className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={colCount + 2} className="px-4 py-12 text-center text-gray-500 text-sm">
                              {doc?.status === 'ERROR'
                                ? `Lỗi OCR: ${doc.ocrError ?? 'Không xác định'}`
                                : 'Kết quả bảng sẽ hiển thị sau khi nhận dạng'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
