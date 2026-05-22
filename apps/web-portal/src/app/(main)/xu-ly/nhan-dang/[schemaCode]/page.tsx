'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, RefreshCw, X, AlertCircle, Check, Save, ScanLine,
  FileText, Plus, Minus, ChevronRight, Download, CheckCircle,
  Loader2, Table2, Grid3X3,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaDetail, DocDetail, DataType, FieldPosition, LineItem } from '@/lib/ocr-api';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANG_OPTIONS = [
  { value: 'vi',    label: 'Tiếng Việt' },
  { value: 'en',    label: 'English' },
  { value: 'vi+en', label: 'Tiếng Việt + English' },
];

const DATA_TYPE_BADGE: Record<DataType, string> = {
  TEXT:     'bg-gray-100 text-gray-600',
  DATE:     'bg-purple-50 text-purple-700',
  NUMBER:   'bg-blue-50 text-blue-700',
  CURRENCY: 'bg-green-50 text-green-700',
  BOOLEAN:  'bg-amber-50 text-amber-700',
  LIST:     'bg-orange-50 text-orange-700',
};

const TYPE_LABEL: Record<DataType, string> = {
  TEXT: 'Văn bản (Text)', DATE: 'Ngày tháng (Date)', NUMBER: 'Số (Number)',
  CURRENCY: 'Tiền tệ (Currency)', BOOLEAN: 'Đúng/Sai (Boolean)', LIST: 'Danh sách (List)',
};

const POS_ICON: Record<FieldPosition, string> = { HEADER: '↑', FOOTER: '↓', BODY: '↔' };
const POS_CLS:  Record<FieldPosition, string> = {
  HEADER: 'text-blue-600', FOOTER: 'text-purple-600', BODY: 'text-gray-500',
};

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(n);
}

const STATUS_CONFIG = {
  DRAFT:     { label: 'Nháp',         cls: 'bg-gray-100  text-gray-700  border-gray-200' },
  PROCESSED: { label: 'Đã xử lý',     cls: 'bg-blue-50   text-blue-700  border-blue-200' },
  CONFIRMED: { label: 'Đã xác nhận',  cls: 'bg-green-50  text-green-700 border-green-200' },
  ERROR:     { label: 'Lỗi OCR',      cls: 'bg-red-50    text-red-700   border-red-200' },
} as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NhanDangOCRPage({ params }: { params: { schemaCode: string } }) {
  const router = useRouter();
  const { schemaCode } = params;

  // Schema
  const [schema, setSchema]           = useState<SchemaDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Upload / OCR
  const [file, setFile]       = useState<File | null>(null);
  const [language, setLanguage] = useState<'vi' | 'en' | 'vi+en'>('vi+en');
  const [enhance, setEnhance] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [polling, setPolling]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  // Document result
  const [doc, setDoc]               = useState<DocDetail | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [lineItems, setLineItems]   = useState<LineItem[]>([]);
  const [dirty, setDirty]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Load schema
  useEffect(() => {
    setSchemaLoading(true);
    setSchemaError(null);
    ocrApi.getSchemaByCode(schemaCode)
      .then(s => setSchema(s))
      .catch(e => setSchemaError((e as Error).message))
      .finally(() => setSchemaLoading(false));
  }, [schemaCode]);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // ── File handling ──────────────────────────────────────────────────────────

  const acceptFile = (f: File) => {
    setFile(f);
    setError(null);
    setDoc(null);
    setFieldValues({});
    setLineItems([]);
    setDirty(false);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => { setDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  };

  // ── OCR processing ─────────────────────────────────────────────────────────

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

  const handleOCR = async () => {
    if (!file || !schema) return;
    setProcessing(true);
    setError(null);
    setDoc(null);
    setFieldValues({});
    setLineItems([]);
    try {
      const res = await ocrApi.uploadDocument(file, schema.id, language);
      setProcessing(false);
      startPolling(res.documentId);
    } catch (e: unknown) {
      setError((e as Error).message);
      setProcessing(false);
    }
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

  const handleConfirm = async () => {
    if (!doc) return;
    if (dirty) { await handleSave(); }
    setConfirming(true);
    try {
      const updated = await ocrApi.confirmDocument(doc.id);
      setDoc(updated);
      setDirty(false);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setConfirming(false); }
  };

  const handleExport = () => {
    if (!doc || !schema) return;
    const rows = schema.fields.map(f => ({
      field: f.label,
      key: f.fieldKey,
      value: fieldValues[f.id] ?? '',
    }));
    const blob = new Blob([JSON.stringify({ schema: schema.code, fields: rows, lineItems }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${schema.code}-${doc.id.slice(0, 8)}.json` });
    a.click(); URL.revokeObjectURL(url);
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

  // ─── Loading / Error screens ──────────────────────────────────────────────

  if (schemaLoading) return (
    <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  );

  if (schemaError || !schema) return (
    <div className="p-8">
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm max-w-lg">
        <AlertCircle className="w-4 h-4 shrink-0" /> {schemaError ?? 'Không tìm thấy schema.'}
      </div>
      <button onClick={() => router.back()} className="mt-3 text-sm text-blue-600 hover:underline">← Quay lại</button>
    </div>
  );

  const docStatus = doc ? STATUS_CONFIG[doc.status] : null;
  const isConfirmed = doc?.status === 'CONFIRMED';
  const isProcessing = processing || polling;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-4 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <ScanLine className="w-3.5 h-3.5" />
          <span>Nhận dạng OCR</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium">{schema.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-900">{schema.name}</h1>
              {docStatus && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${docStatus.cls}`}>
                  {docStatus.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                {schema.type === 'INVOICE' ? 'Hóa đơn' : schema.type === 'RECEIPT' ? 'Bán lẻ' : schema.type === 'CONTRACT' ? 'Hợp đồng' : schema.type}
              </span>
              <code className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">[{schema.code}]</code>
              {schema.description && <span className="text-xs text-gray-400">{schema.description}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {doc && (
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" /> Xuất kết quả
              </button>
            )}
            {doc && !isConfirmed && (
              <>
                {dirty && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={confirming || saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  {confirming ? 'Đang lưu...' : 'Lưu chứng từ'}
                </button>
              </>
            )}
            {isConfirmed && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
                <Check className="w-4 h-4" /> Đã xác nhận
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mt-3 shrink-0 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4">

        {/* ── Left column: Upload + Settings ── */}
        <div className="w-[340px] shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Upload card */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Tải tài liệu</span>
              </div>
              {(file || doc) && (
                <button onClick={handleReset} className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Xóa và tải lại">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* Drop zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                  file ? 'border-blue-300 bg-blue-50/30 cursor-default'
                  : dragging ? 'border-blue-400 bg-blue-50 cursor-copy'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.docx"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
                />
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-500 shrink-0" />
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); }} className="p-1 text-gray-400 hover:text-red-400 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">Kéo thả hoặc click để chọn tệp</p>
                    <p className="text-xs text-gray-400 mt-1">PDF · PNG · JPG · TIFF · DOCX</p>
                  </>
                )}
              </div>

              {/* OCR button */}
              <button
                onClick={handleOCR}
                disabled={!file || isProcessing || isConfirmed}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{processing ? 'Đang tải lên...' : 'Đang nhận dạng...'}</>
                ) : (
                  <><ScanLine className="w-4 h-4" /> Nhận dạng OCR</>
                )}
              </button>

              {/* Status text */}
              <p className={`text-xs text-center ${file ? 'text-gray-500' : 'text-gray-400'}`}>
                {polling ? 'Đang xử lý OCR, vui lòng chờ...'
                  : doc?.status === 'ERROR' ? `Lỗi OCR: ${doc.ocrError ?? 'Không xác định'}`
                  : doc ? `Nhận dạng hoàn tất · ${doc.values.length} giá trị`
                  : file ? 'Đã chọn tệp. Nhấn Nhận dạng OCR để bắt đầu.'
                  : 'Chưa có tệp nào. Vui lòng tải tài liệu lên.'}
              </p>
            </div>
          </div>

          {/* Settings card */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
              <ScanLine className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Cài đặt nhận dạng</span>
            </div>
            <div className="p-4 space-y-4">
              {/* Language */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Ngôn ngữ</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value as typeof language)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* OCR mode */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Chế độ OCR</label>
                <select className="w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Tự động (AI)</option>
                  <option>Thủ công</option>
                </select>
              </div>

              {/* Image enhance toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-700">Tăng cường hình ảnh</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Nâng cao độ chính xác OCR</p>
                </div>
                <button
                  onClick={() => setEnhance(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enhance ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enhance ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* OCR confidence (shown after processing) */}
          {doc && doc.ocrConfidence != null && (
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Độ tin cậy OCR</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${doc.ocrConfidence > 0.8 ? 'bg-green-500' : doc.ocrConfidence > 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${(doc.ocrConfidence * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className={`text-sm font-bold ${doc.ocrConfidence > 0.8 ? 'text-green-600' : doc.ocrConfidence > 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
                  {(doc.ocrConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Fields + Tables ── */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4">

          {/* Fields card */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-blue-50">
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-800">
                  Trường dữ liệu nhận dạng
                  <span className="ml-1.5 text-xs font-normal text-gray-500 bg-white px-1.5 py-0.5 rounded-full border">
                    {schema.fields.length} trường
                  </span>
                </h2>
              </div>
              {doc?.ocrConfidence != null && (
                <span className="text-xs text-gray-400">
                  Độ chính xác: <span className="font-medium text-gray-700">{(doc.ocrConfidence * 100).toFixed(0)}%</span>
                </span>
              )}
            </div>

            {schema.fields.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Grid3X3 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Schema này chưa có trường OCR nào.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-green-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left w-8" />
                    <th className="px-4 py-2.5 text-left">Tên trường</th>
                    <th className="px-4 py-2.5 text-left w-40">Kiểu dữ liệu</th>
                    <th className="px-4 py-2.5 text-left">Giá trị nhận dạng</th>
                    {doc && <th className="px-4 py-2.5 text-center w-20">Tin cậy</th>}
                  </tr>
                </thead>
                <tbody>
                  {schema.fields.map(f => {
                    const docValue = doc?.values.find(v => v.fieldId === f.id);
                    const hasValue = docValue && docValue.stringValue;
                    return (
                      <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold ${POS_CLS[f.position]}`} title={f.position}>
                            {POS_ICON[f.position]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 text-sm">{f.label}</p>
                          <code className="text-[10px] text-gray-400 font-mono">{f.fieldKey}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DATA_TYPE_BADGE[f.dataType]}`}>
                            {TYPE_LABEL[f.dataType]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {doc && !isConfirmed ? (
                            <input
                              type="text"
                              value={fieldValues[f.id] ?? ''}
                              onChange={e => { setFieldValues(prev => ({ ...prev, [f.id]: e.target.value })); setDirty(true); }}
                              placeholder={`Nhập ${f.label.toLowerCase()}`}
                              className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${hasValue ? 'border-green-300 bg-green-50/30' : 'border-dashed'}`}
                            />
                          ) : isConfirmed ? (
                            <span className="text-sm text-gray-800">{fieldValues[f.id] || '—'}</span>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                          {docValue?.isManuallyEdited && (
                            <span className="text-[10px] text-orange-500 mt-0.5 block">Đã chỉnh sửa</span>
                          )}
                        </td>
                        {doc && (
                          <td className="px-4 py-3 text-center">
                            {docValue?.confidence != null ? (
                              <span className={`text-xs font-medium ${docValue.confidence > 0.8 ? 'text-green-600' : docValue.confidence > 0.5 ? 'text-amber-500' : 'text-red-500'}`}>
                                {(docValue.confidence * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Tables section */}
          {schema.tables.map((table, tIdx) => (
            <div key={table.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b bg-orange-50">
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-orange-500" />
                  <h2 className="text-sm font-semibold text-gray-800">{table.name}</h2>
                  <span className="text-xs text-gray-400">{table.columns.length} cột</span>
                </div>
                {doc && !isConfirmed && (
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Thêm dòng
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-green-50 text-gray-500 uppercase tracking-wide font-semibold">
                      <th className="px-3 py-2.5 text-center w-10">STT</th>
                      {tIdx === 0 ? (
                        /* First table uses generic lineItem columns */
                        <>
                          <th className="px-3 py-2.5 text-left min-w-[160px]">Tên hàng hóa / dịch vụ</th>
                          <th className="px-3 py-2.5 text-center w-16">ĐVT</th>
                          <th className="px-3 py-2.5 text-right w-20">Số lượng</th>
                          <th className="px-3 py-2.5 text-right w-28">Đơn giá</th>
                          <th className="px-3 py-2.5 text-right w-28">Thành tiền</th>
                        </>
                      ) : (
                        /* Other tables use schema columns */
                        table.columns.map(col => (
                          <th key={col.id} className="px-3 py-2.5 text-left">{col.label}</th>
                        ))
                      )}
                      {doc && !isConfirmed && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {tIdx === 0 && lineItems.length > 0 ? (
                      lineItems.map(li => (
                        <tr key={li.stt} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 text-center text-gray-400">{li.stt}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text" value={li.name ?? ''}
                              onChange={e => updateLi(li.stt, 'name', e.target.value)}
                              disabled={isConfirmed}
                              className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 disabled:text-gray-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text" value={li.unit ?? ''}
                              onChange={e => updateLi(li.stt, 'unit', e.target.value)}
                              disabled={isConfirmed}
                              className="w-full bg-transparent text-center focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 disabled:text-gray-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" value={li.quantity ?? ''}
                              onChange={e => updateLi(li.stt, 'quantity', e.target.value ? Number(e.target.value) : null)}
                              disabled={isConfirmed}
                              className="w-full bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 disabled:text-gray-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" value={li.unitPrice ?? ''}
                              onChange={e => updateLi(li.stt, 'unitPrice', e.target.value ? Number(e.target.value) : null)}
                              disabled={isConfirmed}
                              className="w-full bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 disabled:text-gray-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{fmt(li.amount)}</td>
                          {!isConfirmed && (
                            <td className="px-2 py-2">
                              <button onClick={() => removeLineItem(li.stt)} className="p-1 text-gray-300 hover:text-red-400 rounded">
                                <Minus className="w-3 h-3" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={tIdx === 0 ? 7 : table.columns.length + 2} className="px-4 py-8 text-center text-gray-400 text-xs">
                          {isProcessing ? 'Đang nhận dạng...' : 'Kết quả bảng sẽ hiển thị sau khi nhận dạng'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Line items summary (first table) */}
              {tIdx === 0 && lineItems.length > 0 && doc && (
                <div className="px-5 py-3 border-t text-right space-y-0.5 bg-gray-50">
                  {doc.totalAmount != null && (
                    <p className="text-xs text-gray-500">Tổng chưa thuế: <span className="font-medium text-gray-700">{fmt(doc.totalAmount)}</span></p>
                  )}
                  {doc.vatAmount != null && (
                    <p className="text-xs text-gray-500">Thuế VAT: <span className="font-medium text-gray-700">{fmt(doc.vatAmount)}</span></p>
                  )}
                  {doc.grandTotal != null && (
                    <p className="text-sm font-semibold text-gray-900">Tổng thanh toán: {fmt(doc.grandTotal)}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Empty state if no tables in schema */}
          {schema.tables.length === 0 && (
            <div className="bg-white rounded-xl border px-5 py-8 text-center text-gray-400 text-sm">
              Schema này không có bảng chi tiết.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
