'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, X, AlertCircle, FileText, Grid3X3, Table2,
  ArrowLeft, Save, ChevronDown, ChevronRight, Settings, ScanLine, Check, GripVertical,
} from 'lucide-react';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaDetail, SchemaField, SchemaTable, DataType, FieldPosition, DocType } from '@/lib/ocr-api';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toKey(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function DataTypeBadge({ dt }: { dt: DataType }) {
  const label = DATA_TYPE_OPTIONS.find(o => o.value === dt)?.label ?? dt;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DATA_TYPE_BADGE[dt]}`}>{label}</span>;
}

// ─── Edit-state types ──────────────────────────────────────────────────────────

interface FieldEdit { label: string; dataType: DataType; position: FieldPosition; description: string; saving: boolean; }
interface ColEdit   { label: string; dataType: DataType; saving: boolean; }
interface TableEdit { name: string; saving: boolean; }

// ─── Add-form types ───────────────────────────────────────────────────────────

interface NewFieldForm { label: string; fieldKey: string; dataType: DataType; position: FieldPosition; description: string; _keyManuallySet: boolean; }
interface NewColForm   { label: string; dataType: DataType; }
interface NewTableForm { name: string; initColLabel: string; initColType: DataType; }

const emptyField = (): NewFieldForm => ({ label: '', fieldKey: '', dataType: 'TEXT', position: 'HEADER', description: '', _keyManuallySet: false });
const emptyCol   = (): NewColForm   => ({ label: '', dataType: 'TEXT' });
const emptyTable = (): NewTableForm => ({ name: '', initColLabel: '', initColType: 'TEXT' });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditSchemaPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [schema, setSchema]       = useState<SchemaDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Metadata ──────────────────────────────────────────────────────────────
  const [name, setName]               = useState('');
  const [type, setType]               = useState<DocType>('INVOICE');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive]       = useState(true);
  const [metaSaving, setMetaSaving]   = useState(false);

  // ── Always-editable row states ────────────────────────────────────────────
  const [fieldEdits, setFieldEdits] = useState<Record<string, FieldEdit>>({});
  const [colEdits, setColEdits]     = useState<Record<string, ColEdit>>({});
  const [tableEdits, setTableEdits] = useState<Record<string, TableEdit>>({});

  // ── Expand tables ─────────────────────────────────────────────────────────
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // ── Inline add field ──────────────────────────────────────────────────────
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField]       = useState<NewFieldForm>(emptyField());
  const [fieldAdding, setFieldAdding] = useState(false);

  // ── Inline add table ──────────────────────────────────────────────────────
  const [addingTable, setAddingTable] = useState(false);
  const [newTable, setNewTable]       = useState<NewTableForm>(emptyTable());
  const [tableAdding, setTableAdding] = useState(false);

  // ── Inline add column ─────────────────────────────────────────────────────
  const [addColTableId, setAddColTableId] = useState<string | null>(null);
  const [newCol, setNewCol]               = useState<NewColForm>(emptyCol());
  const [colAdding, setColAdding]         = useState(false);

  // ── Column drag-and-drop ──────────────────────────────────────────────────
  const [dragColId, setDragColId]       = useState<string | null>(null);
  const [dragColOverId, setDragColOverId] = useState<string | null>(null);
  const dragColFromHandle               = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadSchema = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const data = await ocrApi.getSchema(id);
      setSchema(data);
      setName(data.name);
      setType(data.type);
      setDescription(data.description ?? '');
      setIsActive(data.isActive);
      setExpandedTables(new Set(data.tables.map(t => t.id)));

      const fEdits: Record<string, FieldEdit> = {};
      data.fields.forEach(f => { fEdits[f.id] = { label: f.label, dataType: f.dataType, position: f.position, description: f.description ?? '', saving: false }; });
      setFieldEdits(fEdits);

      const tEdits: Record<string, TableEdit> = {};
      const cEdits: Record<string, ColEdit> = {};
      data.tables.forEach(t => {
        tEdits[t.id] = { name: t.name, saving: false };
        t.columns.forEach(c => { cEdits[c.id] = { label: c.label, dataType: c.dataType, saving: false }; });
      });
      setTableEdits(tEdits);
      setColEdits(cEdits);
    } catch (e: unknown) { setLoadError((e as Error).message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadSchema(); }, [loadSchema]);

  // ── Dirty helpers ──────────────────────────────────────────────────────────

  const isFieldDirty = (f: SchemaField) => {
    const e = fieldEdits[f.id];
    return e && (e.label !== f.label || e.dataType !== f.dataType || e.position !== f.position || e.description !== (f.description ?? ''));
  };

  // ── Metadata save ──────────────────────────────────────────────────────────

  const handleSaveMeta = async () => {
    if (!name.trim()) { setSaveError('Vui lòng nhập tên chứng từ.'); return; }
    setMetaSaving(true); setSaveError(null);
    try {
      await ocrApi.updateSchema(id, { name: name.trim(), type, description: description.trim() || undefined, isActive });
      router.push('/he-thong/ocr');
    } catch (e: unknown) { setSaveError((e as Error).message); }
    finally { setMetaSaving(false); }
  };

  // ── Field save ────────────────────────────────────────────────────────────

  const handleSaveField = async (fieldId: string) => {
    const e = fieldEdits[fieldId];
    if (!e || !e.label.trim()) { setSaveError('Tên trường không được để trống.'); return; }
    setFieldEdits(prev => ({ ...prev, [fieldId]: { ...prev[fieldId], saving: true } }));
    setSaveError(null);
    try {
      const updated = await ocrApi.updateField(id, fieldId, { label: e.label.trim(), dataType: e.dataType, position: e.position, description: e.description.trim() || undefined });
      setSchema(prev => prev ? { ...prev, fields: prev.fields.map(f => f.id === fieldId ? updated : f) } : prev);
      setFieldEdits(prev => ({ ...prev, [fieldId]: { label: updated.label, dataType: updated.dataType, position: updated.position, description: updated.description ?? '', saving: false } }));
    } catch (err: unknown) { setSaveError((err as Error).message); setFieldEdits(prev => ({ ...prev, [fieldId]: { ...prev[fieldId], saving: false } })); }
  };

  // ── Field add ─────────────────────────────────────────────────────────────

  const handleAddField = async () => {
    if (!newField.label.trim()) { setSaveError('Vui lòng nhập tên trường.'); return; }
    setFieldAdding(true);
    try {
      const fieldKey = newField._keyManuallySet && newField.fieldKey.trim() ? newField.fieldKey.trim() : toKey(newField.label);
      const added = await ocrApi.addField(id, { fieldKey, label: newField.label.trim(), dataType: newField.dataType, position: newField.position, isRequired: false, description: newField.description.trim() || undefined });
      setSchema(prev => prev ? { ...prev, fields: [...prev.fields, added] } : prev);
      setFieldEdits(prev => ({ ...prev, [added.id]: { label: added.label, dataType: added.dataType, position: added.position, description: added.description ?? '', saving: false } }));
      setAddingField(false); setNewField(emptyField());
    } catch (e: unknown) { setSaveError((e as Error).message); }
    finally { setFieldAdding(false); }
  };

  // ── Field remove ──────────────────────────────────────────────────────────

  const handleRemoveField = async (field: SchemaField) => {
    if (!confirm(`Xóa trường "${field.label}"?`)) return;
    try {
      await ocrApi.removeField(id, field.id);
      setSchema(prev => prev ? { ...prev, fields: prev.fields.filter(f => f.id !== field.id) } : prev);
      setFieldEdits(prev => { const next = { ...prev }; delete next[field.id]; return next; });
    } catch (e: unknown) { alert((e as Error).message); }
  };

  // ── Table name save ───────────────────────────────────────────────────────

  const handleSaveTable = async (tableId: string) => {
    const e = tableEdits[tableId];
    if (!e || !e.name.trim()) { setSaveError('Tên bảng không được để trống.'); return; }
    setTableEdits(prev => ({ ...prev, [tableId]: { ...prev[tableId], saving: true } }));
    setSaveError(null);
    try {
      const updated = await ocrApi.updateTable(id, tableId, { name: e.name.trim() });
      setSchema(prev => prev ? { ...prev, tables: prev.tables.map(t => t.id === tableId ? { ...t, name: updated.name } : t) } : prev);
      setTableEdits(prev => ({ ...prev, [tableId]: { name: updated.name, saving: false } }));
    } catch (err: unknown) { setSaveError((err as Error).message); setTableEdits(prev => ({ ...prev, [tableId]: { ...prev[tableId], saving: false } })); }
  };

  // ── Table add ─────────────────────────────────────────────────────────────

  const handleAddTable = async () => {
    if (!newTable.name.trim() || !newTable.initColLabel.trim()) { setSaveError('Vui lòng nhập tên bảng và cột đầu tiên.'); return; }
    setTableAdding(true);
    try {
      const added = await ocrApi.addTable(id, { tableKey: toKey(newTable.name), name: newTable.name.trim(), columns: [{ columnKey: toKey(newTable.initColLabel), label: newTable.initColLabel.trim(), dataType: newTable.initColType }] });
      setSchema(prev => prev ? { ...prev, tables: [...prev.tables, added] } : prev);
      setExpandedTables(prev => new Set([...prev, added.id]));
      setTableEdits(prev => ({ ...prev, [added.id]: { name: added.name, saving: false } }));
      added.columns.forEach(c => { setColEdits(prev => ({ ...prev, [c.id]: { label: c.label, dataType: c.dataType, saving: false } })); });
      setAddingTable(false); setNewTable(emptyTable());
    } catch (e: unknown) { setSaveError((e as Error).message); }
    finally { setTableAdding(false); }
  };

  // ── Table remove ──────────────────────────────────────────────────────────

  const handleRemoveTable = async (table: SchemaTable) => {
    if (!confirm(`Xóa bảng "${table.name}"?`)) return;
    try {
      await ocrApi.removeTable(id, table.id);
      setSchema(prev => prev ? { ...prev, tables: prev.tables.filter(t => t.id !== table.id) } : prev);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const toggleExpand = (tableId: string) =>
    setExpandedTables(prev => { const next = new Set(prev); next.has(tableId) ? next.delete(tableId) : next.add(tableId); return next; });

  const reorderColumnsLocal = (tableId: string, fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSchema(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tables: prev.tables.map(t => {
          if (t.id !== tableId) return t;
          const cols = [...t.columns];
          const fromIdx = cols.findIndex(c => c.id === fromId);
          const toIdx   = cols.findIndex(c => c.id === toId);
          if (fromIdx === -1 || toIdx === -1) return t;
          const [item] = cols.splice(fromIdx, 1);
          cols.splice(toIdx, 0, item!);
          return { ...t, columns: cols };
        }),
      };
    });
  };

  // ── Column save ───────────────────────────────────────────────────────────

  const handleSaveCol = async (tableId: string, columnId: string) => {
    const e = colEdits[columnId];
    if (!e || !e.label.trim()) { setSaveError('Tên cột không được để trống.'); return; }
    setColEdits(prev => ({ ...prev, [columnId]: { ...prev[columnId], saving: true } }));
    setSaveError(null);
    try {
      const updated = await ocrApi.updateTableColumn(id, tableId, columnId, { label: e.label.trim(), dataType: e.dataType });
      setSchema(prev => {
        if (!prev) return prev;
        return { ...prev, tables: prev.tables.map(t => t.id === tableId ? { ...t, columns: t.columns.map(c => c.id === columnId ? updated : c) } : t) };
      });
      setColEdits(prev => ({ ...prev, [columnId]: { label: updated.label, dataType: updated.dataType, saving: false } }));
    } catch (err: unknown) { setSaveError((err as Error).message); setColEdits(prev => ({ ...prev, [columnId]: { ...prev[columnId], saving: false } })); }
  };

  // ── Column add ────────────────────────────────────────────────────────────

  const handleAddColumn = async () => {
    if (!addColTableId || !newCol.label.trim()) { setSaveError('Vui lòng nhập tên cột.'); return; }
    setColAdding(true);
    try {
      const added = await ocrApi.addTableColumn(id, addColTableId, { columnKey: toKey(newCol.label), label: newCol.label.trim(), dataType: newCol.dataType, isRequired: false });
      setSchema(prev => {
        if (!prev) return prev;
        return { ...prev, tables: prev.tables.map(t => t.id === addColTableId ? { ...t, columns: [...t.columns, added] } : t) };
      });
      setColEdits(prev => ({ ...prev, [added.id]: { label: added.label, dataType: added.dataType, saving: false } }));
      setAddColTableId(null); setNewCol(emptyCol());
    } catch (e: unknown) { setSaveError((e as Error).message); }
    finally { setColAdding(false); }
  };

  // ── Column remove ─────────────────────────────────────────────────────────

  const handleRemoveColumn = async (tableId: string, columnId: string, label: string) => {
    if (!confirm(`Xóa cột "${label}"?`)) return;
    try {
      await ocrApi.removeTableColumn(id, tableId, columnId);
      setSchema(prev => {
        if (!prev) return prev;
        return { ...prev, tables: prev.tables.map(t => t.id === tableId ? { ...t, columns: t.columns.filter(c => c.id !== columnId) } : t) };
      });
      setColEdits(prev => { const next = { ...prev }; delete next[columnId]; return next; });
    } catch (e: unknown) { alert((e as Error).message); }
  };

  // ─── Screens ─────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Đang tải...</p>
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm max-w-lg">
        <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
      </div>
      <button onClick={() => router.push('/he-thong/ocr')} className="mt-4 text-sm text-blue-600 hover:underline">← Quay lại danh sách</button>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <Settings className="w-3.5 h-3.5" /><span>Cấu hình hệ thống</span>
          <ChevronRight className="w-3 h-3" /><ScanLine className="w-3.5 h-3.5" />
          <button onClick={() => router.push('/he-thong/ocr')} className="hover:text-blue-500 hover:underline">Cấu hình OCR</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium truncate max-w-[200px]">{schema?.code}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/he-thong/ocr')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900">Chỉnh sửa: {schema?.name}</h1>
            <p className="text-xs text-gray-400">
              <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 mr-1">{schema?.code}</code>
              {schema?.fields.length} trường · {schema?.tables.length} bảng
            </p>
          </div>
          <button onClick={() => router.push('/he-thong/ocr')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
            <X className="w-4 h-4" /> Hủy
          </button>
          <button
            onClick={handleSaveMeta}
            disabled={metaSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {metaSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6 space-y-5">
        {saveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
            <button onClick={() => setSaveError(null)} className="ml-auto p-0.5 rounded hover:bg-red-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* ── Card 1: Thông tin ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-blue-50">
            <FileText className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">Thông tin chứng từ</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mã chứng từ</label>
                <input disabled value={schema?.code ?? ''} className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 font-mono text-gray-500 cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1">Không thể thay đổi sau khi tạo</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tên chứng từ <span className="text-red-500">*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Loại chứng từ</label>
                <select value={type} onChange={e => setType(e.target.value as DocType)} className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mô tả</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả ngắn về loại chứng từ..." className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Trạng thái</label>
                <button onClick={() => setIsActive(v => !v)} className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                  </div>
                  <span className={`text-sm font-medium ${isActive ? 'text-green-600' : 'text-gray-500'}`}>{isActive ? 'Đang áp dụng' : 'Tắt'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Các trường OCR ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-blue-50">
            <Grid3X3 className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Các trường OCR
              <span className="ml-1.5 text-xs font-normal text-gray-500 bg-white px-1.5 py-0.5 rounded-full border">{schema?.fields.length ?? 0}</span>
            </h2>
          </div>

          {(schema?.fields.length ?? 0) === 0 && !addingField ? (
            <div className="px-5 py-10 text-center">
              <Grid3X3 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Chưa có trường OCR nào.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-green-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left w-12">STT</th>
                  <th className="px-4 py-2.5 text-left">Tên trường</th>
                  <th className="px-4 py-2.5 text-left w-40">Kiểu dữ liệu</th>
                  <th className="px-4 py-2.5 text-left w-28">Vị trí</th>
                  <th className="px-4 py-2.5 text-left">Mô tả cho AI</th>
                  <th className="px-4 py-2.5 text-center w-20">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {schema?.fields.map((f, idx) => {
                  const e = fieldEdits[f.id];
                  const dirty = isFieldDirty(f);
                  if (!e) return null;
                  return (
                    <tr key={f.id} className={`border-b last:border-0 transition-colors ${dirty ? 'bg-amber-50/30' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={e.label}
                          onChange={ev => setFieldEdits(prev => ({ ...prev, [f.id]: { ...prev[f.id], label: ev.target.value } }))}
                          className="w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                        <code className="text-[10px] text-gray-400 font-mono pl-0.5 mt-0.5 block">{f.fieldKey}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={e.dataType}
                          onChange={ev => setFieldEdits(prev => ({ ...prev, [f.id]: { ...prev[f.id], dataType: ev.target.value as DataType } }))}
                          className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={e.position}
                          onChange={ev => setFieldEdits(prev => ({ ...prev, [f.id]: { ...prev[f.id], position: ev.target.value as FieldPosition } }))}
                          className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={e.description}
                          onChange={ev => setFieldEdits(prev => ({ ...prev, [f.id]: { ...prev[f.id], description: ev.target.value } }))}
                          placeholder="Gợi ý vị trí cho AI (VD: khu vực trên, sau dòng người mua...)"
                          className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSaveField(f.id)}
                            disabled={e.saving || !dirty}
                            title={dirty ? 'Lưu thay đổi' : 'Chưa có thay đổi'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${dirty ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 cursor-default'}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveField(f)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa trường"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Inline add row */}
                {addingField && (
                  <tr className="border-b last:border-0 bg-blue-50/40">
                    <td className="px-4 py-2.5 text-gray-400 text-xs align-top pt-3" />
                    <td className="px-4 py-2.5">
                      <input
                        autoFocus
                        type="text"
                        value={newField.label}
                        onChange={e => {
                          const label = e.target.value;
                          setNewField(prev => ({ ...prev, label, fieldKey: prev._keyManuallySet ? prev.fieldKey : toKey(label) }));
                        }}
                        placeholder="Tên trường *"
                        className="w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={newField.fieldKey}
                        onChange={e => setNewField(prev => ({ ...prev, fieldKey: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''), _keyManuallySet: true }))}
                        placeholder="field_key (tự tạo)"
                        className="w-full mt-1 px-2.5 py-1 text-xs border border-dashed rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-gray-500 bg-gray-50"
                      />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <select value={newField.dataType} onChange={e => setNewField(prev => ({ ...prev, dataType: e.target.value as DataType }))} className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <select value={newField.position} onChange={e => setNewField(prev => ({ ...prev, position: e.target.value as FieldPosition }))} className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <input
                        type="text"
                        value={newField.description}
                        onChange={e => setNewField(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Gợi ý vị trí cho AI..."
                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={handleAddField} disabled={fieldAdding} className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50" title="Xác nhận"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setAddingField(false); setNewField(emptyField()); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Hủy"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-4 py-3 border-t bg-gray-50/50">
                    <button
                      onClick={() => { setAddingField(true); setNewField(emptyField()); }}
                      disabled={addingField}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm trường
                    </button>
                  </td>
                </tr>
              </tfoot>
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
                <span className="ml-1.5 text-xs font-normal text-gray-500 bg-white px-1.5 py-0.5 rounded-full border">{schema?.tables.length ?? 0}</span>
              </h2>
            </div>
            <button
              onClick={() => { setAddingTable(true); setNewTable(emptyTable()); }}
              className="flex items-center gap-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm bảng
            </button>
          </div>

          {(schema?.tables.length ?? 0) === 0 && !addingTable ? (
            <div className="px-5 py-10 text-center">
              <Table2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Chưa có bảng OCR nào.</p>
            </div>
          ) : (
            <div className="divide-y">
              {schema?.tables.map(t => {
                const expanded = expandedTables.has(t.id);
                const isAddingCol = addColTableId === t.id;
                const te = tableEdits[t.id];
                const tableNameDirty = te && te.name !== t.name;
                return (
                  <div key={t.id}>
                    {/* Table header */}
                    <div className="flex items-center gap-3 px-5 py-3">
                      <button onClick={() => toggleExpand(t.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Table2 className="w-4 h-4 text-orange-400 shrink-0" />
                      {te ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            value={te.name}
                            onChange={ev => setTableEdits(prev => ({ ...prev, [t.id]: { ...prev[t.id], name: ev.target.value } }))}
                            className={`flex-1 px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${tableNameDirty ? 'bg-amber-50/50' : 'bg-white'}`}
                          />
                          <code className="text-xs text-gray-400 font-mono shrink-0">{t.tableKey}</code>
                          <span className="text-xs text-gray-400 shrink-0">· {t.columns.length} cột</span>
                          <button
                            onClick={() => handleSaveTable(t.id)}
                            disabled={te.saving || !tableNameDirty}
                            title={tableNameDirty ? 'Lưu tên bảng' : 'Chưa có thay đổi'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${tableNameDirty ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 cursor-default'}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                          <code className="ml-2 text-xs text-gray-400 font-mono">{t.tableKey}</code>
                          <span className="ml-2 text-xs text-gray-400">· {t.columns.length} cột</span>
                        </div>
                      )}
                      <button onClick={() => handleRemoveTable(t)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa bảng">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Columns */}
                    {expanded && (
                      <div className="mx-5 mb-3 rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-green-50 border-b text-gray-500 uppercase tracking-wide font-semibold">
                              <th className="px-3 py-2 w-8"></th>
                              <th className="px-3 py-2 text-left w-8">STT</th>
                              <th className="px-3 py-2 text-left">Tên cột</th>
                              <th className="px-3 py-2 text-left w-44">Kiểu dữ liệu</th>
                              <th className="px-3 py-2 text-center w-20">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.columns.map((c, cIdx) => {
                              const ce = colEdits[c.id];
                              const colDirty = ce && (ce.label !== c.label || ce.dataType !== c.dataType);
                              if (!ce) return null;
                              return (
                                <tr
                                  key={c.id}
                                  draggable
                                  onDragStart={e => { if (!dragColFromHandle.current) { e.preventDefault(); return; } setDragColId(c.id); dragColFromHandle.current = false; }}
                                  onDragOver={e => { e.preventDefault(); setDragColOverId(c.id); }}
                                  onDrop={e => { e.preventDefault(); if (dragColId) reorderColumnsLocal(t.id, dragColId, c.id); setDragColId(null); setDragColOverId(null); }}
                                  onDragEnd={() => { setDragColId(null); setDragColOverId(null); dragColFromHandle.current = false; }}
                                  className={`border-b last:border-0 transition-colors ${
                                    dragColOverId === c.id && dragColId !== c.id ? 'border-t-2 border-blue-400' : ''
                                  } ${dragColId === c.id ? 'opacity-40' : colDirty ? 'bg-amber-50/30' : 'hover:bg-gray-50'}`}
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
                                      value={ce.label}
                                      onChange={ev => setColEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], label: ev.target.value } }))}
                                      className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                    />
                                    <code className="text-[10px] text-gray-400 font-mono pl-0.5 mt-0.5 block">{c.columnKey}</code>
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={ce.dataType}
                                      onChange={ev => setColEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], dataType: ev.target.value as DataType } }))}
                                      className="w-full px-2 py-1 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                      {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleSaveCol(t.id, c.id)}
                                        disabled={ce.saving || !colDirty}
                                        title={colDirty ? 'Lưu thay đổi' : 'Chưa có thay đổi'}
                                        className={`p-1 rounded transition-colors disabled:opacity-40 ${colDirty ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 cursor-default'}`}
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => handleRemoveColumn(t.id, c.id, c.label)} className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors" title="Xóa cột">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Inline add column */}
                            {isAddingCol && (
                              <tr className="border-b last:border-0 bg-blue-50/30">
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 text-gray-400 align-top pt-2.5">{t.columns.length + 1}</td>
                                <td className="px-3 py-2">
                                  <input autoFocus value={newCol.label} onChange={e => setNewCol(prev => ({ ...prev, label: e.target.value }))} placeholder="Tên cột *" className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <select value={newCol.dataType} onChange={e => setNewCol(prev => ({ ...prev, dataType: e.target.value as DataType }))} className="w-full px-2 py-1 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                    {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-center align-top">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={handleAddColumn} disabled={colAdding} className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50" title="Xác nhận"><Check className="w-3 h-3" /></button>
                                    <button onClick={() => { setAddColTableId(null); setNewCol(emptyCol()); }} className="p-1 text-gray-300 hover:text-gray-600 rounded" title="Hủy"><X className="w-3 h-3" /></button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={5} className="px-3 py-2 border-t bg-gray-50/50">
                                <button
                                  onClick={() => { setAddColTableId(t.id); setNewCol(emptyCol()); setExpandedTables(prev => new Set([...prev, t.id])); }}
                                  disabled={isAddingCol}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                );
              })}

              {/* Inline add table */}
              {addingTable && (
                <div>
                  <div className="flex items-center gap-3 px-5 py-3 bg-orange-50/40">
                    <Table2 className="w-4 h-4 text-orange-400 shrink-0" />
                    <input autoFocus value={newTable.name} onChange={e => setNewTable(prev => ({ ...prev, name: e.target.value }))} placeholder="Tên bảng *" className="flex-1 px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <button onClick={() => { setAddingTable(false); setNewTable(emptyTable()); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="mx-5 mb-3 rounded-lg border overflow-hidden">
                    <div className="bg-green-50 border-b px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cột đầu tiên</div>
                    <div className="flex items-center gap-3 px-3 py-2 bg-blue-50/30">
                      <span className="text-gray-400 text-xs w-6 shrink-0">1</span>
                      <input value={newTable.initColLabel} onChange={e => setNewTable(prev => ({ ...prev, initColLabel: e.target.value }))} placeholder="Tên cột *" className="flex-1 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <select value={newTable.initColType} onChange={e => setNewTable(prev => ({ ...prev, initColType: e.target.value as DataType }))} className="w-40 px-2 py-1.5 text-xs border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                        {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button onClick={handleAddTable} disabled={tableAdding || !newTable.name.trim() || !newTable.initColLabel.trim()} className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-40" title="Xác nhận tạo bảng">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
