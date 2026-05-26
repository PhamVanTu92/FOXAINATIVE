'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, X, AlertCircle, FileText, Grid3X3,
  Table2, ArrowLeft, Save, ChevronDown, ChevronRight,
  Settings, ScanLine, GripVertical,
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
  { value: 'TEXT',     label: 'Văn bản' },
  { value: 'DATE',     label: 'Ngày tháng' },
  { value: 'NUMBER',   label: 'Số' },
  { value: 'CURRENCY', label: 'Tiền tệ' },
  { value: 'BOOLEAN',  label: 'Đúng/Sai' },
  { value: 'LIST',     label: 'Danh sách' },
];

const POSITION_OPTIONS: { value: FieldPosition; label: string }[] = [
  { value: 'HEADER', label: 'Header' },
  { value: 'FOOTER', label: 'Footer' },
  { value: 'BODY',   label: 'Body' },
];

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldRow {
  label: string;
  fieldKey: string;
  dataType: DataType;
  position: FieldPosition;
  isRequired: boolean;
  description: string;
  _keyManuallySet: boolean;
}

interface ColumnRow {
  label: string;
  columnKey: string;
  dataType: DataType;
  isRequired: boolean;
  description: string;
  _keyManuallySet: boolean;
}

interface TableRow {
  name: string;
  tableKey: string;
  columns: ColumnRow[];
  expanded: boolean;
  _keyManuallySet: boolean;
}

const newField = (): FieldRow => ({
  label: '', fieldKey: '', dataType: 'TEXT', position: 'HEADER',
  isRequired: false, description: '', _keyManuallySet: false,
});

const newColumn = (): ColumnRow => ({
  label: '', columnKey: '', dataType: 'TEXT', isRequired: false,
  description: '', _keyManuallySet: false,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaoMoiOcrPage() {
  const router = useRouter();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<DocType>('INVOICE');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldRow[]>([newField()]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragFromHandle = useRef(false);

  const [dragColState, setDragColState] = useState<{ tIdx: number; cIdx: number } | null>(null);
  const [dragColOverIdx, setDragColOverIdx] = useState<{ tIdx: number; cIdx: number } | null>(null);
  const dragColFromHandle = useRef(false);

  const reorderFields = (from: number, to: number) => {
    if (from === to) return;
    setFields(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item!);
      return arr;
    });
  };

  const reorderColumns = (tIdx: number, from: number, to: number) => {
    if (from === to) return;
    setTables(prev => prev.map((t, i) => {
      if (i !== tIdx) return t;
      const cols = [...t.columns];
      const [item] = cols.splice(from, 1);
      cols.splice(to, 0, item!);
      return { ...t, columns: cols };
    }));
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

  const removeField = (idx: number) => setFields(prev => prev.filter((_, i) => i !== idx));

  // ── Table handlers ───────────────────────────────────────────────────────────

  const addTable = () => setTables(prev => [...prev, {
    name: '', tableKey: '', expanded: true,
    _keyManuallySet: false,
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

    const fkSeen = new Set<string>();
    for (const f of validFields) {
      if (fkSeen.has(f.fieldKey)) { setSaveError(`Field Key "${f.fieldKey}" bị trùng lặp — mỗi trường phải có Field Key duy nhất.`); return; }
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
          description: f.description.trim() || undefined,
        })),
        tables: validTables.length > 0 ? validTables.map(t => ({
          tableKey: t.tableKey, name: t.name,
          columns: t.columns.map(c => ({
            columnKey: c.columnKey, label: c.label, dataType: c.dataType, isRequired: c.isRequired,
            description: c.description || undefined,
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

      {/* ── Content ── */}
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
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-blue-50">
            <Grid3X3 className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Các trường OCR
              <span className="ml-1.5 text-xs font-normal text-gray-500 bg-white px-1.5 py-0.5 rounded-full border">
                {fields.length}
              </span>
            </h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-green-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left w-12"></th>
                <th className="px-4 py-2.5 text-left">Tên trường & Field Key</th>
                <th className="px-4 py-2.5 text-left w-36">Kiểu dữ liệu</th>
                <th className="px-4 py-2.5 text-left w-28">Vị trí</th>
                <th className="px-4 py-2.5 text-left">
                  Mô tả cho AI
                  <span className="ml-1 text-[10px] font-normal text-gray-400 normal-case">(gợi ý vị trí để phân biệt trường trùng tên)</span>
                </th>
                <th className="px-4 py-2.5 text-center w-12"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, idx) => (
                <tr
                  key={idx}
                  draggable
                  onDragStart={e => { if (!dragFromHandle.current) { e.preventDefault(); return; } setDragIdx(idx); dragFromHandle.current = false; }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                  onDrop={e => { e.preventDefault(); if (dragIdx !== null) reorderFields(dragIdx, idx); setDragIdx(null); setDragOverIdx(null); }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); dragFromHandle.current = false; }}
                  className={`border-b last:border-0 transition-colors ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-blue-400' : ''} ${dragIdx === idx ? 'opacity-40' : 'hover:bg-gray-50/50'}`}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <GripVertical
                        className="w-3.5 h-3.5 text-gray-300 cursor-grab active:cursor-grabbing"
                        onMouseDown={() => { dragFromHandle.current = true; }}
                      />
                      <span className="text-gray-300 text-xs">{idx + 1}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={f.label}
                      onChange={e => updateFieldLabel(idx, e.target.value)}
                      placeholder="Tên trường *"
                      className="w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={f.fieldKey}
                      onChange={e => updateFieldKey(idx, e.target.value)}
                      placeholder="field_key (tự tạo từ tên)"
                      className="w-full mt-1 px-2.5 py-1 text-xs border border-dashed rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-gray-500 bg-gray-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={f.dataType}
                      onChange={e => updateField(idx, 'dataType', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={f.position}
                      onChange={e => updateField(idx, 'position', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={f.description}
                      onChange={e => updateField(idx, 'description', e.target.value)}
                      placeholder="VD: Địa chỉ BÊN BÁN, khu vực phần trên hóa đơn"
                      className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeField(idx)}
                      disabled={fields.length === 1}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Xóa trường"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="px-4 py-3 border-t bg-gray-50/50">
                  <button
                    onClick={addField}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm trường
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
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
              <p className="text-sm text-gray-400">Chưa có bảng OCR nào. Nhấn &quot;Thêm bảng&quot; để tạo.</p>
            </div>
          ) : (
            <div className="divide-y">
              {tables.map((t, tIdx) => (
                <div key={tIdx}>
                  {/* ── Table meta row ── */}
                  <div className="flex items-center gap-3 px-5 py-3">
                    <button onClick={() => toggleExpand(tIdx)} className="text-gray-400 hover:text-gray-600 shrink-0">
                      {t.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <Table2 className="w-4 h-4 text-orange-400 shrink-0" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        value={t.name}
                        onChange={e => updateTableName(tIdx, e.target.value)}
                        placeholder="Tên bảng *"
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        value={t.tableKey}
                        onChange={e => updateTableKey(tIdx, e.target.value)}
                        placeholder="table_key"
                        className="w-40 px-2.5 py-1.5 text-xs border border-dashed rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-gray-500 bg-gray-50"
                      />
                      <span className="text-xs text-gray-400 shrink-0">{t.columns.length} cột</span>
                    </div>
                    <button
                      onClick={() => removeTable(tIdx)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Xóa bảng"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* ── Columns ── */}
                  {t.expanded && (
                    <div className="mx-5 mb-3 rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-green-50 border-b text-gray-500 uppercase tracking-wide font-semibold">
                            <th className="px-3 py-2 w-8"></th>
                            <th className="px-3 py-2 text-left w-8">#</th>
                            <th className="px-3 py-2 text-left">Tên cột & Column Key</th>
                            <th className="px-3 py-2 text-left w-36">Kiểu dữ liệu</th>
                            <th className="px-3 py-2 text-left">Mô tả cho AI</th>
                            <th className="px-3 py-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.columns.map((c, cIdx) => (
                            <tr
                              key={cIdx}
                              draggable
                              onDragStart={e => { if (!dragColFromHandle.current) { e.preventDefault(); return; } setDragColState({ tIdx, cIdx }); dragColFromHandle.current = false; }}
                              onDragOver={e => { e.preventDefault(); setDragColOverIdx({ tIdx, cIdx }); }}
                              onDrop={e => { e.preventDefault(); if (dragColState && dragColState.tIdx === tIdx) reorderColumns(tIdx, dragColState.cIdx, cIdx); setDragColState(null); setDragColOverIdx(null); }}
                              onDragEnd={() => { setDragColState(null); setDragColOverIdx(null); dragColFromHandle.current = false; }}
                              className={`border-b last:border-0 transition-colors ${
                                dragColOverIdx?.tIdx === tIdx && dragColOverIdx?.cIdx === cIdx && dragColState?.cIdx !== cIdx ? 'border-t-2 border-blue-400' : ''
                              } ${dragColState?.tIdx === tIdx && dragColState?.cIdx === cIdx ? 'opacity-40' : 'hover:bg-gray-50/50'}`}
                            >
                              <td className="px-3 py-2">
                                <GripVertical
                                  className="w-3.5 h-3.5 text-gray-300 cursor-grab active:cursor-grabbing"
                                  onMouseDown={() => { dragColFromHandle.current = true; }}
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-400">{cIdx + 1}</td>
                              <td className="px-3 py-2">
                                <input
                                  value={c.label}
                                  onChange={e => updateColumnLabel(tIdx, cIdx, e.target.value)}
                                  placeholder="Tên cột *"
                                  className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                  value={c.columnKey}
                                  onChange={e => updateColumnKey(tIdx, cIdx, e.target.value)}
                                  placeholder="column_key"
                                  className="w-full mt-1 px-2 py-1 text-[11px] border border-dashed rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-gray-500 bg-gray-50"
                                />
                              </td>
                              <td className="px-3 py-2 align-top pt-2">
                                <select
                                  value={c.dataType}
                                  onChange={e => updateColumn(tIdx, cIdx, 'dataType', e.target.value)}
                                  className="w-full px-2 py-1.5 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2 align-top pt-2">
                                <input
                                  value={c.description}
                                  onChange={e => updateColumn(tIdx, cIdx, 'description', e.target.value)}
                                  placeholder="VD: cột giá trị trước thuế..."
                                  className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-600"
                                />
                              </td>
                              <td className="px-3 py-2 text-center align-top pt-2">
                                <button
                                  onClick={() => removeColumn(tIdx, cIdx)}
                                  disabled={t.columns.length === 1}
                                  className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Xóa cột"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={6} className="px-3 py-2 border-t bg-gray-50/50">
                              <button
                                onClick={() => addColumn(tIdx)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Thêm cột
                              </button>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
