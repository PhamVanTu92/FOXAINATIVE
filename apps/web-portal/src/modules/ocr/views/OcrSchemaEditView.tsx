'use client';

import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, X, AlertCircle, FileText, Grid3X3, Table2,
  ArrowLeft, Save, ChevronDown, ChevronRight, Settings, ScanLine, Check, GripVertical, Bot, Zap,
} from 'lucide-react';
import { useOcrSchemaEdit } from '../hooks/useOcrSchemaEdit';
import { TYPE_OPTIONS, DATA_TYPE_OPTIONS, POSITION_OPTIONS, PROMPT_TEMPLATES, toKey } from '../constants';
import type { DataType, FieldPosition, DocType } from '@/lib/ocr-api';

interface Props {
  id: string;
}

export function OcrSchemaEditView({ id }: Props) {
  const router = useRouter();
  const {
    schema, loadError, loading, saveError, canSave, metaSaving,
    name, type, description, isActive,
    fieldEdits, colEdits, tableEdits, expandedTables, pendingCols,
    addingField, newField, fieldAdding,
    addingTable, newTable, tableAdding,
    dragFieldId, dragFieldOverId, dragColId, dragColOverId,
    dragFieldFromHandle, dragColFromHandle,
    setName, setType, setDescription, setIsActive, setSaveError,
    setFieldEdits, setColEdits, setTableEdits,
    setDragFieldId, setDragFieldOverId, setDragColId, setDragColOverId,
    setAddingField, setNewField, setAddingTable, setNewTable,
    reorderFieldsLocal, reorderColumnsLocal,
    handleSaveMeta, handleAddField, handleRemoveField,
    handleAddTable, handleRemoveTable, toggleExpand,
    addPendingCol, updatePendingCol, removePendingCol, handleRemoveColumn,
  } = useOcrSchemaEdit(id);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Cấu hình hệ thống</span>
          <ChevronRight className="w-3 h-3" />
          <ScanLine className="w-3.5 h-3.5" />
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
            disabled={metaSaving || !canSave}
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

        {/* ── Card 1: Thông tin chứng từ ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-blue-50">
            <FileText className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">Thông tin chứng từ</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4">
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
            <div className="mt-4 flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Trạng thái:</label>
              <button onClick={() => setIsActive(v => !v)} className="flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-green-600' : 'text-gray-500'}`}>{isActive ? 'Đang áp dụng' : 'Tắt'}</span>
              </button>
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
                  <th className="px-4 py-2.5 text-left w-12"></th>
                  <th className="px-4 py-2.5 text-left">Tên trường</th>
                  <th className="px-4 py-2.5 text-left w-48">Field Key</th>
                  <th className="px-4 py-2.5 text-left w-36">Kiểu dữ liệu</th>
                  <th className="px-4 py-2.5 text-left w-28">Vị trí</th>
                  <th className="px-4 py-2.5 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {schema?.fields.map((f, idx) => {
                  const e = fieldEdits[f.id];
                  if (!e) return null;
                  return (
                    <tr
                      key={f.id}
                      draggable
                      onDragStart={ev => { if (!dragFieldFromHandle.current) { ev.preventDefault(); return; } setDragFieldId(f.id); dragFieldFromHandle.current = false; }}
                      onDragOver={ev => { ev.preventDefault(); setDragFieldOverId(f.id); }}
                      onDrop={ev => { ev.preventDefault(); if (dragFieldId) reorderFieldsLocal(dragFieldId, f.id); setDragFieldId(null); setDragFieldOverId(null); }}
                      onDragEnd={() => { setDragFieldId(null); setDragFieldOverId(null); dragFieldFromHandle.current = false; }}
                      className={`border-b last:border-0 transition-colors ${dragFieldOverId === f.id && dragFieldId !== f.id ? 'border-t-2 border-blue-400' : ''} ${dragFieldId === f.id ? 'opacity-40' : 'hover:bg-gray-50/50'}`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <GripVertical
                            className="w-3.5 h-3.5 text-gray-300 cursor-grab active:cursor-grabbing"
                            onMouseDown={() => { dragFieldFromHandle.current = true; }}
                          />
                          <span className="text-gray-300 text-xs">{idx + 1}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={e.label}
                          onChange={ev => setFieldEdits(prev => ({ ...prev, [f.id]: { ...prev[f.id]!, label: ev.target.value } }))}
                          placeholder="Tên trường *"
                          className="w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input disabled value={f.fieldKey} className="w-full px-2.5 py-1.5 text-xs border border-dashed rounded-lg font-mono text-gray-500 bg-gray-50 cursor-not-allowed" />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={e.dataType}
                          onChange={ev => setFieldEdits(prev => ({ ...prev, [f.id]: { ...prev[f.id]!, dataType: ev.target.value as DataType } }))}
                          className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={e.position}
                          onChange={ev => setFieldEdits(prev => ({ ...prev, [f.id]: { ...prev[f.id]!, position: ev.target.value as FieldPosition } }))}
                          className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRemoveField(f)}
                          disabled={(schema?.fields.length ?? 0) === 1}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Xóa trường"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Inline add row */}
                {addingField && (
                  <tr className="border-b last:border-0 bg-blue-50/40">
                    <td className="px-3 py-3">
                      <span className="text-gray-300 text-xs">{(schema?.fields.length ?? 0) + 1}</span>
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={newField.fieldKey}
                        onChange={e => setNewField(prev => ({ ...prev, fieldKey: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''), _keyManuallySet: true }))}
                        placeholder="field_key"
                        className="w-full px-2.5 py-1.5 text-xs border border-dashed rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-gray-500 bg-gray-50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select value={newField.dataType} onChange={e => setNewField(prev => ({ ...prev, dataType: e.target.value as DataType }))} className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={newField.position} onChange={e => setNewField(prev => ({ ...prev, position: e.target.value as FieldPosition }))} className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={handleAddField} disabled={fieldAdding} className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50" title="Xác nhận"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setAddingField(false); setNewField({ label: '', fieldKey: '', dataType: 'TEXT', position: 'HEADER', description: '', _keyManuallySet: false }); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Hủy"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-4 py-3 border-t bg-gray-50/50">
                    <button
                      onClick={() => { setAddingField(true); setNewField({ label: '', fieldKey: '', dataType: 'TEXT', position: 'HEADER', description: '', _keyManuallySet: false }); }}
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
              onClick={() => { setAddingTable(true); setNewTable({ name: '', initColLabel: '', initColType: 'TEXT' }); }}
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
                const te = tableEdits[t.id];
                return (
                  <div key={t.id}>
                    <div className="flex items-center gap-3 px-5 py-3">
                      <button onClick={() => toggleExpand(t.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Table2 className="w-4 h-4 text-orange-400 shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          value={te?.name ?? t.name}
                          onChange={ev => setTableEdits(prev => ({ ...prev, [t.id]: { ...prev[t.id]!, name: ev.target.value } }))}
                          placeholder="Tên bảng"
                          className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input disabled value={t.tableKey} className="w-40 px-2.5 py-1.5 text-xs border border-dashed rounded-lg font-mono text-gray-500 bg-gray-50 cursor-not-allowed" />
                        <span className="text-xs text-gray-400 shrink-0">{t.columns.length} cột</span>
                      </div>
                      <button onClick={() => handleRemoveTable(t)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0" title="Xóa bảng">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {expanded && (
                      <div className="mx-5 mb-3 rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-green-50 border-b text-gray-500 uppercase tracking-wide font-semibold">
                              <th className="px-3 py-2 w-8"></th>
                              <th className="px-3 py-2 text-left w-8">#</th>
                              <th className="px-3 py-2 text-left">Tên cột</th>
                              <th className="px-3 py-2 text-left w-40">Column Key</th>
                              <th className="px-3 py-2 text-left w-36">Kiểu dữ liệu</th>
                              <th className="px-3 py-2 text-center w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.columns.map((c, cIdx) => {
                              const ce = colEdits[c.id];
                              if (!ce) return null;
                              return (
                                <tr
                                  key={c.id}
                                  draggable
                                  onDragStart={ev => { if (!dragColFromHandle.current) { ev.preventDefault(); return; } setDragColId(c.id); dragColFromHandle.current = false; }}
                                  onDragOver={ev => { ev.preventDefault(); setDragColOverId(c.id); }}
                                  onDrop={ev => { ev.preventDefault(); if (dragColId) reorderColumnsLocal(t.id, dragColId, c.id); setDragColId(null); setDragColOverId(null); }}
                                  onDragEnd={() => { setDragColId(null); setDragColOverId(null); dragColFromHandle.current = false; }}
                                  className={`border-b last:border-0 transition-colors ${dragColOverId === c.id && dragColId !== c.id ? 'border-t-2 border-blue-400' : ''} ${dragColId === c.id ? 'opacity-40' : 'hover:bg-gray-50/50'}`}
                                >
                                  <td className="px-3 py-2">
                                    <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab active:cursor-grabbing" onMouseDown={() => { dragColFromHandle.current = true; }} />
                                  </td>
                                  <td className="px-3 py-2 text-gray-400">{cIdx + 1}</td>
                                  <td className="px-3 py-2">
                                    <input
                                      value={ce.label}
                                      onChange={ev => setColEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id]!, label: ev.target.value } }))}
                                      className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input disabled value={c.columnKey} className="w-full px-2 py-1.5 text-[11px] border border-dashed rounded font-mono text-gray-500 bg-gray-50 cursor-not-allowed" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={ce.dataType}
                                      onChange={ev => setColEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id]!, dataType: ev.target.value as DataType } }))}
                                      className="w-full px-2 py-1.5 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                      {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button onClick={() => handleRemoveColumn(t.id, c.id, c.label)} disabled={t.columns.length === 1} className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Xóa cột">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Pending new columns */}
                            {(pendingCols[t.id] ?? []).map((pc, pcIdx) => (
                              <tr key={pc.tempId} className="border-b last:border-0 bg-blue-50/20">
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 text-gray-400">{t.columns.length + pcIdx + 1}</td>
                                <td className="px-3 py-2">
                                  <input autoFocus={pcIdx === 0} value={pc.label} onChange={e => updatePendingCol(t.id, pc.tempId, { label: e.target.value })} placeholder="Tên cột *" className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </td>
                                <td className="px-3 py-2">
                                  <input disabled value={toKey(pc.label)} placeholder="auto" className="w-full px-2 py-1.5 text-[11px] border border-dashed rounded font-mono text-gray-400 bg-gray-50 cursor-not-allowed" />
                                </td>
                                <td className="px-3 py-2">
                                  <select value={pc.dataType} onChange={e => updatePendingCol(t.id, pc.tempId, { dataType: e.target.value as DataType })} className="w-full px-2 py-1.5 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                    {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button onClick={() => removePendingCol(t.id, pc.tempId)} className="p-1 text-gray-300 hover:text-red-400 rounded" title="Xóa"><X className="w-3 h-3" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={6} className="px-3 py-2 border-t bg-gray-50/50">
                                <button onClick={() => addPendingCol(t.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
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
                    <button onClick={() => { setAddingTable(false); setNewTable({ name: '', initColLabel: '', initColType: 'TEXT' }); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-3.5 h-3.5" /></button>
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

        {/* ── Card 4: Prompt cho AI ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-purple-50">
            <Bot className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-800">Prompt cho AI</h2>
            <span className="ml-1 text-xs text-gray-400 font-normal">(áp dụng chung cho toàn bộ chứng từ này)</span>
          </div>
          <div className="p-5">
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-yellow-500" />
                Prompt mẫu cho case khó:
              </p>
              <div className="flex flex-wrap gap-2">
                {PROMPT_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setDescription(prev => prev.trim() ? `${prev.trim()}\n\n${tpl.text}` : tpl.text)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors"
                  >
                    <Zap className="w-3 h-3 text-purple-400" />
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              placeholder={`Nhập hướng dẫn chung cho AI khi nhận dạng loại chứng từ này.`}
              className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y min-h-[120px] text-gray-700 placeholder:text-gray-300 leading-relaxed"
            />
            <p className="text-xs text-gray-400 mt-2">
              Prompt này được đưa vào câu hỏi gửi AI mỗi lần quét tài liệu thuộc loại chứng từ này.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
