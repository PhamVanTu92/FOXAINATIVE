'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, RefreshCw, X, AlertCircle, Check, Save, ScanLine,
  FileText, Plus, Minus, ChevronRight, Download,
  Loader2, Table2, Grid3X3, Sparkles,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaDetail, DocDetail, DataType, LineItem } from '@/lib/ocr-api';

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
  DRAFT:     { label: 'Nháp',        cls: 'bg-gray-100  text-gray-700  border-gray-200' },
  PROCESSED: { label: 'Đã xử lý',    cls: 'bg-blue-50   text-blue-700  border-blue-200' },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'bg-green-50  text-green-700 border-green-200' },
  ERROR:     { label: 'Lỗi OCR',     cls: 'bg-red-50    text-red-700   border-red-200' },
} as const;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const [doc, setDoc]               = useState<DocDetail | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [lineItems, setLineItems]   = useState<LineItem[]>([]);
  const [dirty, setDirty]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    ocrApi.getSchemaByCode(schemaCode)
      .then(s => setSchema(s))
      .catch(e => setSchemaError((e as Error).message))
      .finally(() => setSchemaLoading(false));
  }, [schemaCode]);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // ── Polling ────────────────────────────────────────────────────────────────

  const startPolling = useCallback((docId: string) => {
    setPolling(true);
    pollingRef.current = setInterval(async () => {
      try {
        const result = await ocrApi.getDocument(docId);
        if (result.status !== 'DRAFT') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setDoc(result);
          const vals: Record<string, string> = {};
          for (const v of result.values) vals[v.fieldId] = v.stringValue ?? '';
          setFieldValues(vals);
          setLineItems([...result.lineItems]);
          setPolling(false);
          setDirty(false);
        }
      } catch {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setPolling(false);
        setError('Lỗi khi theo dõi tiến trình OCR.');
      }
    }, 2000);
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
      startPolling(res.documentId);
    } catch (e: unknown) {
      setError((e as Error).message);
      setProcessing(false);
    }
  }, [startPolling]);

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
        lineItems: lineItems.map(({ stt, name, unit, quantity, unitPrice, amount }) =>
          ({ stt, name, unit, quantity, unitPrice, amount })),
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
          lineItems: lineItems.map(({ stt, name, unit, quantity, unitPrice, amount }) =>
            ({ stt, name, unit, quantity, unitPrice, amount })),
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
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; setPolling(false); }
  };

  const addLineItem = () => {
    const stt = lineItems.length ? Math.max(...lineItems.map(li => li.stt)) + 1 : 1;
    setLineItems(prev => [...prev, { id: '', stt, name: '', unit: '', quantity: null, unitPrice: null, amount: null, isManuallyAdded: true }]);
    setDirty(true);
  };

  const removeLineItem = (stt: number) => { setLineItems(prev => prev.filter(li => li.stt !== stt)); setDirty(true); };

  const updateLi = <K extends keyof LineItem>(stt: number, key: K, value: LineItem[K]) => {
    setLineItems(prev => prev.map(li => li.stt === stt ? { ...li, [key]: value } : li));
    setDirty(true);
  };

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
      <div className="bg-white border-b px-6 py-3 shrink-0">
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
              {schema.type === 'INVOICE' ? 'Hóa đơn' : schema.type === 'RECEIPT' ? 'Bán lẻ' : schema.type === 'CONTRACT' ? 'Hợp đồng' : schema.type}
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
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.docx"
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
            ) : file ? (
              <div className="flex items-center justify-center gap-3 py-5">
                <FileText className="w-7 h-7 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-sm">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB · Kéo thả tệp mới để quét lại</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleReset(); }}
                  className="p-1 text-gray-400 hover:text-red-400 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-1.5">
                <Upload className="w-9 h-9 text-blue-300 mb-1" />
                <p className="text-base font-semibold text-gray-700">Kéo thả hoặc click để chọn tệp</p>
                <p className="text-sm text-gray-400">PDF · PNG · JPG · TIFF</p>
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
              {doc.totalAmount != null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-gray-500">Chưa thuế:</span>
                  <span className="font-mono font-semibold text-gray-800">{fmt(doc.totalAmount)}</span>
                </div>
              )}
              {doc.vatAmount != null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-gray-500">VAT:</span>
                  <span className="font-mono font-semibold text-gray-800">{fmt(doc.vatAmount)}</span>
                </div>
              )}
              {doc.grandTotal != null && (
                <>
                  <div className="h-4 w-px bg-gray-200" />
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-semibold text-gray-700">Tổng thanh toán:</span>
                    <span className={`font-mono font-bold text-base ${confTextColor}`}>{fmt(doc.grandTotal)}</span>
                  </div>
                </>
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
                            className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                              hasValue
                                ? 'border-green-300 bg-green-50 text-gray-900'
                                : 'border-gray-300 bg-gray-50 text-gray-600 placeholder:text-gray-400'
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
          ) : schema.tables.map((table, tIdx) => (
            <div key={table.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b bg-orange-50">
                <div className="flex items-center gap-2.5">
                  <Table2 className="w-4 h-4 text-orange-500" />
                  <h2 className="text-sm font-semibold text-orange-800">{table.name}</h2>
                  {lineItems.length > 0 && tIdx === 0 && (
                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                      {lineItems.length} dòng
                    </span>
                  )}
                </div>
                {doc && !isConfirmed && (
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1.5 text-xs text-orange-700 bg-white border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm dòng
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-100 text-gray-600 uppercase tracking-wide font-semibold text-xs">
                      <th className="px-3 py-2.5 text-center w-10">STT</th>
                      {tIdx === 0 ? (
                        <>
                          <th className="px-3 py-2.5 text-left">Tên hàng hóa / dịch vụ</th>
                          <th className="px-3 py-2.5 text-center w-16">ĐVT</th>
                          <th className="px-3 py-2.5 text-right w-20">Số lượng</th>
                          <th className="px-3 py-2.5 text-right w-28">Đơn giá</th>
                          <th className="px-3 py-2.5 text-right w-32">Thành tiền</th>
                        </>
                      ) : (
                        table.columns.map(col => (
                          <th key={col.id} className="px-3 py-2.5 text-left">{col.label}</th>
                        ))
                      )}
                      {doc && !isConfirmed && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {isProcessing ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-4 py-3 text-center"><div className="h-4 bg-gray-100 rounded animate-pulse w-6 mx-auto" /></td>
                          {Array.from({ length: tIdx === 0 ? 5 : table.columns.length }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    ) : tIdx === 0 && lineItems.length > 0 ? (
                      lineItems.map((li, liIdx) => (
                        <tr key={li.stt} className={`border-b last:border-0 hover:bg-blue-50/20 ${liIdx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                          <td className="px-4 py-3 text-center text-sm font-medium text-gray-500">{li.stt}</td>
                          <td className="px-4 py-3">
                            <input type="text" value={li.name ?? ''} onChange={e => updateLi(li.stt, 'name', e.target.value)} disabled={isConfirmed}
                              className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded px-1.5 py-1 disabled:text-gray-700 text-gray-900 text-sm" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="text" value={li.unit ?? ''} onChange={e => updateLi(li.stt, 'unit', e.target.value)} disabled={isConfirmed}
                              className="w-full bg-transparent text-center focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded px-1.5 py-1 disabled:text-gray-700 text-gray-900 text-sm" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" value={li.quantity ?? ''} onChange={e => updateLi(li.stt, 'quantity', e.target.value ? Number(e.target.value) : null)} disabled={isConfirmed}
                              className="w-full bg-transparent text-right focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded px-1.5 py-1 disabled:text-gray-700 text-gray-900 text-sm" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" value={li.unitPrice ?? ''} onChange={e => updateLi(li.stt, 'unitPrice', e.target.value ? Number(e.target.value) : null)} disabled={isConfirmed}
                              className="w-full bg-transparent text-right focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded px-1.5 py-1 disabled:text-gray-700 text-gray-900 text-sm" />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-800 font-semibold text-sm">{fmt(li.amount)}</td>
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
                        <td colSpan={tIdx === 0 ? 7 : table.columns.length + 2} className="px-4 py-12 text-center text-gray-500 text-sm">
                          {doc?.status === 'ERROR'
                            ? `Lỗi OCR: ${doc.ocrError ?? 'Không xác định'}`
                            : 'Kết quả bảng sẽ hiển thị sau khi nhận dạng'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {tIdx === 0 && lineItems.length > 0 && doc && (doc.totalAmount != null || doc.grandTotal != null) && (
                <div className="px-5 py-3.5 border-t bg-slate-50 flex items-center justify-end gap-6 text-sm">
                  {doc.totalAmount != null && (
                    <span className="text-gray-600">Chưa thuế: <span className="font-semibold text-gray-800 font-mono">{fmt(doc.totalAmount)}</span></span>
                  )}
                  {doc.vatAmount != null && (
                    <span className="text-gray-600">VAT: <span className="font-semibold text-gray-800 font-mono">{fmt(doc.vatAmount)}</span></span>
                  )}
                  {doc.grandTotal != null && (
                    <span className="text-gray-700 font-semibold border-l pl-6">Tổng thanh toán: <span className="text-blue-700 font-mono text-base">{fmt(doc.grandTotal)}</span></span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
