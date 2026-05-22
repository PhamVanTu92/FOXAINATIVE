'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, X, AlertCircle, FileText, Grid3X3,
  Table2, ArrowLeft, Save, ChevronDown, ChevronRight,
  Settings, ScanLine, Pencil, Check, GripVertical,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { DataType, FieldPosition, DocType } from '@/lib/ocr-api';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'INVOICE',           label: 'Hóa đơn' },
  { value: 'RECEIPT',           label: 'Hóa đơn bán lẻ' },
  { value: 'CONTRACT',          label: 'Hợp đồng' },
  { value: 'STATEMENT',         label: 'Bảng kê' },
  { value: 'MINUTES',           label: 'Biên bản' },
  { value: 'WAREHOUSE_RECEIPT', label: 'Phiếu nhập kho' },
  { value: 'OTHERS',            label: 'Khác' },
];

const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
  { value: 'TEXT',     label: 'Văn bản (Text)' },
  { value: 'DATE',     label: 'Ngày tháng (Date)' },
  { value: 'NUMBER',   label: 'Số (Number)' },
  { value: 'CURRENCY', label: 'Tiền tệ (Currency)' },
  { value: 'BOOLEAN',  label: 'Đúng/Sai (Boolean)' },
  { value: 'LIST',     label: 'Danh sách (List)' },
];

const DATA_TYPE_BADGE: Record<DataType, string> = {
  TEXT:     'bg-gray-100 text-gray-700',
  DATE:     'bg-purple-50 text-purple-700',
  NUMBER:   'bg-blue-50 text-blue-700',
  CURRENCY: 'bg-green-50 text-green-700',
  BOOLEAN:  'bg-amber-50 text-amber-700',
  LIST:     'bg-orange-50 text-orange-700',
};

const POSITION_OPTIONS: { value: FieldPosition; label: string }[] = [
  { value: 'HEADER', label: 'Header' },
  { value: 'FOOTER', label: 'Footer' },
  { value: 'BODY',   label: 'Body' },
];

const POSITION_BADGE: Record<FieldPosition, { arrow: string; cls: string }> = {
  HEADER: { arrow: '↑', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  FOOTER: { arrow: '↓', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  BODY:   { arrow: '↔', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function DataTypeBadge({ dt }: { dt: DataType }) {
  const label = DATA_TYPE_OPTIONS.find(o => o.value === dt)?.label ?? dt;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DATA_TYPE_BADGE[dt]}`}>
      {label}
    </span>
  );
}

function PositionBadge({ pos }: { pos: FieldPosition }) {
  const conf = POSITION_BADGE[pos];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${conf.cls}`}>
      {conf.arrow} {pos.charAt(0) + pos.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldRow {
  label: string;
  fieldKey: string;
  dataType: DataType;
  position: FieldPosition;
  isRequired: boolean;
  description: string;
  _keyManuallySet: boolean;
  isEditing: boolean;
}

interface ColumnRow {
  label: string;
  columnKey: string;
  dataType: DataType;
  isRequired: boolean;
  description: string;
  _keyManuallySet: boolean;
  isEditing: boolean;
}

interface TableRow {
  name: string;
  tableKey: string;
  columns: ColumnRow[];
  expanded: boolean;
  _keyManuallySet: boolean;
  isEditingMeta: boolean;
}

const newField = (): FieldRow => ({
  label: '', fieldKey: '', dataType: 'TEXT', position: 'HEADER',
  isRequired: false, description: '', _keyManuallySet: false, isEditing: true,
});

const newColumn = (): ColumnRow => ({
  label: '', columnKey: '', dataType: 'TEXT', isRequired: false,
  description: '', _keyManuallySet: false, isEditing: true,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaoMoiOcrPage() {
  const router = useRouter();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<DocType>('INVOICE');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const reorderFields = (from: number, to: number) => {
    if (from === to) return;
    setFields(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item!);
      return arr;
    });
  };

  // ── Field handlers ───────────────────────────────────────────────────────────

  const addField = () => setFields(prev => [...prev, newField()]);

  const updateFieldLabel = (idx: number, val: string) =>
    setFields(prev => prev.map((f, i) => i !== idx ? f : {
      ...f, label: val,
      fieldKey: f._keyManuallySet ? f.fieldKey : toKey(val),
    }));

  const updateFieldKey = (idx: number, val: string) =>
    setFields(prev => prev.map((f, i) => i !== idx ? f : {
      ...f, fieldKey: val.replace(/[^a-zA-Z0-9_]/g, ''), _keyManuallySet: true,
    }));

  const updateField = (idx: number, key: keyof FieldRow, val: string | boolean) =>
    setFields(prev => prev.map((f, i) => i !== idx ? f : { ...f, [key]: val } as FieldRow));

  const confirmField = (idx: number) =>
    setFields(prev => prev.map((f, i) => i !== idx ? f : { ...f, isEditing: false }));

  const editField = (idx: number) =>
    setFields(prev => prev.map((f, i) => i !== idx ? f : { ...f, isEditing: true }));

  const removeField = (idx: number) => setFields(prev => prev.filter((_, i) => i !== idx));

  // ── Table handlers ───────────────────────────────────────────────────────────

  const addTable = () => setTables(prev => [...prev, {
    name: '', tableKey: '', expanded: true,
    _keyManuallySet: false, isEditingMeta: true,
    columns: [newColumn()],
  }]);

  const updateTableName = (tIdx: number, val: string) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, name: val,
      tableKey: t._keyManuallySet ? t.tableKey : toKey(val),
    }));

  const updateTableKey = (tIdx: number, val: string) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, tableKey: val.replace(/[^a-zA-Z0-9_]/g, ''), _keyManuallySet: true,
    }));

  const confirmTableMeta = (tIdx: number) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : { ...t, isEditingMeta: false }));

  const editTableMeta = (tIdx: number) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : { ...t, isEditingMeta: true }));

  const removeTable = (tIdx: number) => setTables(prev => prev.filter((_, i) => i !== tIdx));

  const toggleExpand = (tIdx: number) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : { ...t, expanded: !t.expanded }));

  // ── Column handlers ──────────────────────────────────────────────────────────

  const addColumn = (tIdx: number) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, expanded: true, columns: [...t.columns, newColumn()],
    }));

  const updateColumnLabel = (tIdx: number, cIdx: number, val: string) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, columns: t.columns.map((c, j) => j !== cIdx ? c : {
        ...c, label: val,
        columnKey: c._keyManuallySet ? c.columnKey : toKey(val),
      }),
    }));

  const updateColumnKey = (tIdx: number, cIdx: number, val: string) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, columns: t.columns.map((c, j) => j !== cIdx ? c : {
        ...c, columnKey: val.replace(/[^a-zA-Z0-9_]/g, ''), _keyManuallySet: true,
      }),
    }));

  const updateColumn = (tIdx: number, cIdx: number, key: keyof ColumnRow, val: string | boolean) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, columns: t.columns.map((c, j) => j !== cIdx ? c : { ...c, [key]: val } as ColumnRow),
    }));

  const confirmColumn = (tIdx: number, cIdx: number) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, columns: t.columns.map((c, j) => j !== cIdx ? c : { ...c, isEditing: false }),
    }));

  const editColumn = (tIdx: number, cIdx: number) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, columns: t.columns.map((c, j) => j !== cIdx ? c : { ...c, isEditing: true }),
    }));

  const removeColumn = (tIdx: number, cIdx: number) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, columns: t.columns.filter((_, j) => j !== cIdx),
    }));

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaveError(null);
    if (!code.trim()) { setSaveError('Vui lòng nhập mã chứng từ.'); return; }
    if (!name.trim()) { setSaveError('Vui lòng nhập tên chứng từ.'); return; }
    const validFields = fields.filter(f => f.label.trim() && f.fieldKey.trim());
    if (validFields.length === 0) { setSaveError('Cần ít nhất 1 trường OCR hợp lệ.'); return; }
    const validTables = tables
      .map(t => ({ ...t, columns: t.columns.filter(c => c.label.trim() && c.columnKey.trim()) }))
      .filter(t => t.name.trim() && t.tableKey.trim() && t.columns.length > 0);

    // Guard: duplicate fieldKeys
    const fkSeen = new Set<string>();
    for (const f of validFields) {
      if (fkSeen.has(f.fieldKey)) { setSaveError(`Trường "${f.fieldKey}" bị trùng lặp. Hãy đặt tên khác nhau.`); return; }
      fkSeen.add(f.fieldKey);
    }

    setSaving(true);
    try {
      await ocrApi.createSchema({
        code: code.toUpperCase().trim(),
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        fields: validFields.map(f => ({
          fieldKey: f.fieldKey, label: f.label, dataType: f.dataType,
          position: f.position, isRequired: f.isRequired,
        })),
        tables: validTables.length > 0 ? validTables.map(t => ({
          tableKey: t.tableKey, name: t.name,
          columns: t.columns.map(c => ({
            columnKey: c.columnKey, label: c.label, dataType: c.dataType, isRequired: c.isRequired,
          })),
        })) : undefined,
      });
      router.push('/he-thong/ocr');
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Cấu hình hệ thống</span>
          <ChevronRight className="w-3 h-3" />
          <ScanLine className="w-3.5 h-3.5" />
          <button onClick={() => router.push('/he-thong/ocr')} className="hover:text-blue-500 hover:underline">
            Cấu hình OCR
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium">Tạo mới</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/he-thong/ocr')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900">Tạo mới chứng từ OCR</h1>
            <p className="text-xs text-gray-400">Thiết lập cấu hình nhận dạng cho loại chứng từ mới</p>
          </div>
          <button
            onClick={() => router.push('/he-thong/ocr')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 border rounded-lg hover:bg-gray-50"
          >
            <X className="w-4 h-4" /> Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {/* ── Content (full width) ── */}
      <div className="p-6 space-y-5">
        {saveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* ── Card 1: Thông tin chứng từ ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-blue-50">
            <FileText className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">Thông tin chứng từ</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Mã chứng từ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_\-]/g, ''))}
                  placeholder="VD: OCR-HDVAT"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                />
                <p className="text-xs text-gray-400 mt-1">Chữ hoa, số, _ và -</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Tên chứng từ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="VD: Hóa đơn VAT đầu vào"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Loại chứng từ <span className="text-red-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as DocType)}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Mô tả</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về loại chứng từ này"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ── Card 2: Các trường OCR ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-blue-50">
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-800">
                Các trường OCR
                <span className="ml-1.5 text-xs font-normal text-gray-500 bg-white px-1.5 py-0.5 rounded-full border">
                  {fields.length}
                </span>
              </h2>
            </div>
            <button
              onClick={addField}
              className="flex items-center gap-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm trường
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Grid3X3 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Chưa có trường OCR nào. Nhấn &quot;Thêm trường&quot; để bắt đầu.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-green-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left w-16">STT</th>
                  <th className="px-4 py-2.5 text-left">Tên trường</th>
                  <th className="px-4 py-2.5 text-left w-44">Kiểu dữ liệu</th>
                  <th className="px-4 py-2.5 text-left w-28">Vị trí</th>
                  <th className="px-4 py-2.5 text-left">Ghi chú</th>
                  <th className="px-4 py-2.5 text-center w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, idx) => f.isEditing ? (
                  /* ── Edit row ── */
                  <tr
                    key={idx}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDrop={e => { e.preventDefault(); if (dragIdx !== null) reorderFields(dragIdx, idx); setDragIdx(null); setDragOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={`border-b last:border-0 bg-blue-50/40 transition-colors ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-blue-400' : ''} ${dragIdx === idx ? 'opacity-40' : ''}`}
                  >
                    <td className="px-4 py-3 align-top pt-3.5">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab active:cursor-grabbing shrink-0" />
                        <span className="text-gray-400 text-xs">{idx + 1}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={f.label}
                        onChange={e => updateFieldLabel(idx, e.target.value)}
                        placeholder="Tên trường *"
                        className="w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-3 align-top pt-3">
                      <select
                        value={f.dataType}
                        onChange={e => updateField(idx, 'dataType', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top pt-3">
                      <select
                        value={f.position}
                        onChange={e => updateField(idx, 'position', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top pt-3">
                      <input
                        type="text"
                        value={f.description}
                        onChange={e => updateField(idx, 'description', e.target.value)}
                        placeholder="Ghi chú (tùy chọn)"
                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 align-top pt-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => confirmField(idx)}
                          className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                          title="Xác nhận"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeField(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ── Display row ── */
                  <tr
                    key={idx}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDrop={e => { e.preventDefault(); if (dragIdx !== null) reorderFields(dragIdx, idx); setDragIdx(null); setDragOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-blue-400' : ''} ${dragIdx === idx ? 'opacity-40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab active:cursor-grabbing shrink-0" />
                        <span className="text-gray-400 text-xs">{idx + 1}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 text-sm">{f.label}</p>
                      <code className="text-xs text-gray-400 font-mono">{f.fieldKey}</code>
                    </td>
                    <td className="px-4 py-3">
                      <DataTypeBadge dt={f.dataType} />
                    </td>
                    <td className="px-4 py-3">
                      <PositionBadge pos={f.position} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {f.description || '—'}
                      {f.isRequired && (
                        <span className="ml-2 text-red-400 text-[10px] font-medium">Bắt buộc</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => editField(idx)}
                          className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeField(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Card 3: Các bảng OCR ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-orange-50">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-800">
                Các bảng OCR
                <span className="ml-1.5 text-xs font-normal text-gray-500 bg-white px-1.5 py-0.5 rounded-full border">
                  {tables.length}
                </span>
              </h2>
            </div>
            <button
              onClick={addTable}
              className="flex items-center gap-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm bảng
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Table2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Chưa có bảng OCR nào. Nhấn &quot;Thêm bảng&quot; để tạo bảng đầu tiên.</p>
            </div>
          ) : (
            <div className="divide-y">
              {tables.map((t, tIdx) => (
                <div key={tIdx}>
                  {/* ── Table meta row ── */}
                  {t.isEditingMeta ? (
                    <div className="flex items-center gap-3 px-5 py-3 bg-orange-50/40">
                      <Table2 className="w-4 h-4 text-orange-400 shrink-0" />
                      <input
                        value={t.name}
                        onChange={e => updateTableName(tIdx, e.target.value)}
                        placeholder="Tên bảng *"
                        autoFocus
                        className="flex-1 px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => confirmTableMeta(tIdx)}
                        className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        title="Xác nhận"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeTable(tIdx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa bảng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3">
                      <button onClick={() => toggleExpand(tIdx)} className="text-gray-400 hover:text-gray-600 shrink-0">
                        {t.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Table2 className="w-4 h-4 text-orange-400 shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                        <code className="ml-2 text-xs text-gray-400 font-mono">{t.tableKey}</code>
                        <span className="ml-2 text-xs text-gray-400">· {t.columns.length} cột</span>
                      </div>
                      <button
                        onClick={() => addColumn(tIdx)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Thêm cột
                      </button>
                      <button
                        onClick={() => editTableMeta(tIdx)}
                        className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Sửa tên bảng"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeTable(tIdx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa bảng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* ── Columns ── */}
                  {t.expanded && !t.isEditingMeta && (
                    <div className="mx-5 mb-3 rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-green-50 border-b text-gray-500 uppercase tracking-wide font-semibold">
                            <th className="px-3 py-2 text-left w-8">STT</th>
                            <th className="px-3 py-2 text-left">Tên cột</th>
                            <th className="px-3 py-2 text-left w-40">Kiểu dữ liệu</th>
                            <th className="px-3 py-2 text-left">Ghi chú</th>
                            <th className="px-3 py-2 text-center w-20">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.columns.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-3 text-center text-gray-400">Chưa có cột nào.</td>
                            </tr>
                          ) : t.columns.map((c, cIdx) => c.isEditing ? (
                            /* ── Edit column row ── */
                            <tr key={cIdx} className="border-b last:border-0 bg-blue-50/30">
                              <td className="px-3 py-2 text-gray-400 align-top pt-2.5">{cIdx + 1}</td>
                              <td className="px-3 py-2">
                                <input
                                  value={c.label}
                                  onChange={e => updateColumnLabel(tIdx, cIdx, e.target.value)}
                                  placeholder="Tên cột *"
                                  autoFocus
                                  className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2 align-top">
                                <select
                                  value={c.dataType}
                                  onChange={e => updateColumn(tIdx, cIdx, 'dataType', e.target.value)}
                                  className="w-full px-2 py-1 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <input
                                  value={c.description}
                                  onChange={e => updateColumn(tIdx, cIdx, 'description', e.target.value)}
                                  placeholder="Ghi chú"
                                  className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-center align-top">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => confirmColumn(tIdx, cIdx)}
                                    className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                    title="Xác nhận"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => removeColumn(tIdx, cIdx)}
                                    className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            /* ── Display column row ── */
                            <tr key={cIdx} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-2 text-gray-400">{cIdx + 1}</td>
                              <td className="px-3 py-2">
                                <p className="font-medium text-gray-800">{c.label}</p>
                                <code className="text-[10px] text-gray-400 font-mono">{c.columnKey}</code>
                              </td>
                              <td className="px-3 py-2">
                                <DataTypeBadge dt={c.dataType} />
                              </td>
                              <td className="px-3 py-2 text-gray-500">{c.description || '—'}</td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => editColumn(tIdx, cIdx)}
                                    className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                    title="Sửa"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => removeColumn(tIdx, cIdx)}
                                    className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Card 4: Ghi chú ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
            <FileText className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Ghi chú cấu hình OCR</h2>
          </div>
          <div className="p-5">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nhập ghi chú cho các trường hoặc cột đã khai báo, hướng dẫn nhận dạng, hoặc lưu ý đặc biệt khi OCR chứng từ này..."
              rows={4}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
