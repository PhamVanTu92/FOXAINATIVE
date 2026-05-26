'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, RefreshCw, X, AlertCircle, AlertTriangle, Check, Save, ScanLine,
  FileText, Plus, Minus, ChevronRight, Download,
  Loader2, Table2, Grid3X3, Sparkles, Image as ImageIcon,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaDetail, DocDetail, DataType, LineItem, SseEvent } from '@/lib/ocr-api';

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
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${cls}`}>
      {pct}%
    </span>
  );
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
  if (['xlsx', 'xls'].includes(ext)) return { Icon: Table2,     color: 'text-green-500',  label: 'Excel' };
  if (ext === 'csv')                  return { Icon: Table2,     color: 'text-teal-500',   label: 'CSV' };
  if (ext === 'docx')                 return { Icon: FileText,   color: 'text-blue-500',   label: 'Word' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'tif'].includes(ext))
                                      return { Icon: ImageIcon,  color: 'text-purple-500', label: 'Ảnh' };
  return                                     { Icon: FileText,   color: 'text-red-400',    label: 'PDF' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NhanDangOCRPage({ params }: { params: { schemaCode: string } }) {
  const router = useRouter();
  const { schemaCode } = params;

  const [schema, setSchema]           = useState<SchemaDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [file, setFile]         = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [polling, setPolling]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [doc, setDoc]               = useState<DocDetail | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [lineItems, setLineItems]   = useState<LineItem[]>([]);
  const [dirty, setDirty]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [focusedCellKey, setFocusedCellKey] = useState<string | null>(null);

  useEffect(() => {
    ocrApi.getSchemaByCode(schemaCode)
      .then(s => setSchema(s))
      .catch(e => setSchemaError((e as Error).message))
      .finally(() => setSchemaLoading(false));
  }, [schemaCode]);

  useEffect(() => () => { if (eventSourceRef.current) eventSourceRef.current.close(); }, []);

  // ── SSE: theo dõi tiến trình OCR real-time ─────────────────────────────────

  const startSSE = useCallback((docId: string) => {
    setPolling(true);
    const es = new EventSource(ocrApi.getDocumentSseUrl(docId));
    eventSourceRef.current = es;

    es.onmessage = (event: MessageEvent<string>) => {
      let data: SseEvent;
      try { data = JSON.parse(event.data) as SseEvent; } catch { return; }

      if (data.type === 'done') {
        es.close();
        eventSourceRef.current = null;
        setDoc(data.document);
        const vals: Record<string, string> = {};
        for (const v of data.document.values) vals[v.fieldId] = v.stringValue ?? '';
        setFieldValues(vals);
        setLineItems([...data.document.lineItems]);
        setPolling(false);
        setDirty(false);
      } else if (data.type === 'failed') {
        es.close();
        eventSourceRef.current = null;
        setPolling(false);
        setError(data.error);
      }
      // type === 'progress': chờ tiếp, không cần làm gì
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setPolling(false);
      setError('Mất kết nối khi theo dõi tiến trình OCR.');
    };
  }, []);

  // ── Auto-OCR on file select ────────────────────────────────────────────────

  const triggerOCR = useCallback(async (f: File, s: SchemaDetail) => {
    setProcessing(true);
    setError(null);
    setDoc(null);
    setFieldValues({});
    setLineItems([]);
    try {
      const res = await ocrApi.uploadDocument(f, s.id, 'vi+en');
      setProcessing(false);
      startSSE(res.documentId);
    } catch (e: unknown) {
      setError((e as Error).message);
      setProcessing(false);
    }
  }, [startSSE]);

  const acceptFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
    setDoc(null);
    setFieldValues({});
    setLineItems([]);
    setDirty(false);
    if (schema) triggerOCR(f, schema);
  }, [schema, triggerOCR]);

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  };

  // ── Save / Confirm ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const updated = await ocrApi.updateDocument(doc.id, {
        values: Object.entries(fieldValues).map(([fieldId, stringValue]) => ({ fieldId, stringValue })),
        lineItems: lineItems.map(({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData }) =>
          ({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData })),
      });
      setDoc(updated);
      setDirty(false);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleSaveAndExit = async () => {
    if (!doc) return;
    setConfirming(true);
    try {
      if (dirty) {
        const updated = await ocrApi.updateDocument(doc.id, {
          values: Object.entries(fieldValues).map(([fieldId, stringValue]) => ({ fieldId, stringValue })),
          lineItems: lineItems.map(({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData }) =>
            ({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData })),
        });
        setDoc(updated);
        setDirty(false);
      }
      router.push('/xu-ly/chung-tu');
    } catch (e: unknown) { setError((e as Error).message); }
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

  const handleReset = () => {
    setFile(null); setDoc(null); setFieldValues({}); setLineItems([]); setDirty(false); setError(null);
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; setPolling(false); }
  };

  const addLineItem = (tableKey?: string) => {
    const stt = lineItems.length ? Math.max(...lineItems.map(li => li.stt)) + 1 : 1;
    setLineItems(prev => [...prev, { id: '', stt, tableKey: tableKey ?? null, name: '', unit: '', quantity: null, unitPrice: null, amount: null, isManuallyAdded: true }]);
    setDirty(true);
  };

  const removeLineItem = (stt: number) => { setLineItems(prev => prev.filter(li => li.stt !== stt)); setDirty(true); };

  const updateLi = <K extends keyof LineItem>(stt: number, key: K, value: LineItem[K]) => {
    setLineItems(prev => prev.map(li => li.stt === stt ? { ...li, [key]: value } : li));
    setDirty(true);
  };

  const updateLiExtra = (stt: number, colKey: string, value: string) => {
    setLineItems(prev => prev.map(li =>
      li.stt === stt ? { ...li, extraData: { ...(li.extraData ?? {}), [colKey]: value } } : li,
    ));
    setDirty(true);
  };

  // ─── Arithmetic validation ────────────────────────────────────────────────

  const arithmeticWarnings = useMemo(() => {
    const w = { lineItems: new Set<number>(), fields: new Set<string>() };
    if (!doc || !schema || processing || polling) return w;

    // Per line item: amount ≈ qty × unitPrice (tolerance ≤ 1 VND)
    for (const li of lineItems) {
      if (li.quantity != null && li.unitPrice != null && li.amount != null) {
        if (Math.abs(li.quantity * li.unitPrice - li.amount) > 1) w.lineItems.add(li.stt);
      }
    }

    // Find IDs for standard currency fields by fieldKey
    const fid = (key: string) => schema.fields.find(f => f.fieldKey === key)?.id;
    const fTotal = fid('totalAmount');
    const fVat   = fid('vatAmount');
    const fGrand = fid('grandTotal');

    const parseNum = (id: string | undefined) => {
      if (!id) return null;
      const raw = (fieldValues[id] ?? '').replace(/[^\d.-]/g, '');
      const n = parseFloat(raw);
      return isNaN(n) ? null : n;
    };

    const total = parseNum(fTotal);
    const vat   = parseNum(fVat);
    const grand = parseNum(fGrand);

    // Check Σ(lineItems.amount) ≈ totalAmount
    if (fTotal && total != null && lineItems.length > 0) {
      const sum = lineItems.reduce((acc, li) => acc + (li.amount ?? 0), 0);
      if (Math.abs(sum - total) > 1) w.fields.add(fTotal);
    }

    // Check totalAmount + vatAmount ≈ grandTotal
    if (total != null && vat != null && grand != null) {
      if (Math.abs(total + vat - grand) > 1) {
        if (fTotal) w.fields.add(fTotal);
        if (fVat)   w.fields.add(fVat);
        if (fGrand) w.fields.add(fGrand);
      }
    }

    return w;
  }, [doc, schema, lineItems, fieldValues, processing, polling]);

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

  const docStatus   = doc ? STATUS_CONFIG[doc.status] : null;
  const isConfirmed = doc?.status === 'CONFIRMED';
  const isProcessing = processing || polling;
  const confPct = doc?.ocrConfidence != null ? Math.round(doc.ocrConfidence * 100) : null;
  const confColor = confPct == null ? '' : confPct > 85 ? 'bg-green-500' : confPct > 60 ? 'bg-amber-400' : 'bg-red-400';
  const confTextColor = confPct == null ? '' : confPct > 85 ? 'text-green-600' : confPct > 60 ? 'text-amber-600' : 'text-red-600';

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

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-4 mt-3 shrink-0 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Arithmetic warning banner ── */}
      {hasArithmeticWarnings && !isProcessing && doc && (
        <div className="mx-4 mt-2 shrink-0 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm shadow-sm">
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

        {/* ── Row 1: Upload ── */}
        <div className="shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Drop zone — full width */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`w-full transition-all cursor-pointer ${
              isProcessing ? 'cursor-default' :
              dragging ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff,.docx,.xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); e.target.value = ''; }}
            />

            {isProcessing ? (
              <div className="flex items-center justify-center gap-3 py-6">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500 shrink-0" />
                <div className="text-center">
                  <p className="text-base font-semibold text-blue-600">
                    {processing ? 'Đang tải lên...' : 'Đang nhận dạng...'}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">{file?.name}</p>
                </div>
              </div>
            ) : file ? (() => {
              const { Icon: FIcon, color: fColor, label: fLabel } = getFileIcon(file.name);
              return (
              <div className="flex items-center justify-center gap-3 py-5">
                <FIcon className={`w-7 h-7 ${fColor} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-sm">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{fLabel} · {(file.size / 1024).toFixed(0)} KB · Kéo thả tệp mới để quét lại</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleReset(); }}
                  className="p-1 text-gray-400 hover:text-red-400 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-8 gap-1.5">
                <Upload className="w-9 h-9 text-blue-300 mb-1" />
                <p className="text-base font-semibold text-gray-700">Kéo thả hoặc click để chọn tệp</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap justify-center">
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-red-400" /> PDF</span>
                  <span className="text-gray-200">·</span>
                  <span className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5 text-purple-400" /> PNG · JPG · TIFF</span>
                  <span className="text-gray-200">·</span>
                  <span className="flex items-center gap-1"><Table2 className="w-3.5 h-3.5 text-green-500" /> Excel · CSV</span>
                  <span className="text-gray-200">·</span>
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-blue-500" /> Word</span>
                </div>
                <p className="text-sm text-blue-500 mt-2 flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-4 h-4" />
                  Chọn tệp để AI tự động nhận dạng ngay
                </p>
              </div>
            )}
          </div>

          {/* Stats bar — shows after OCR */}
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

        {/* ── Row 2: Fields ── */}
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
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                Schema này chưa có trường OCR nào.
              </div>
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
                            onChange={e => { setFieldValues(prev => ({ ...prev, [f.id]: e.target.value })); setDirty(true); }}
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

        {/* ── Row 3: Tables ── */}
        <div className="shrink-0 space-y-4">
          {schema.tables.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-center">
              <Table2 className="w-8 h-8 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Schema này chưa có bảng dữ liệu</p>
            </div>
          ) : schema.tables.map((table, tIdx) => {
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
                  Bảng này chưa có cột nào được cấu hình trong schema. Vui lòng cấu hình cột để xem và chỉnh sửa dữ liệu.
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
                                ? new Intl.NumberFormat('vi-VN').format(Number(rawStr))
                                : rawStr;
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
