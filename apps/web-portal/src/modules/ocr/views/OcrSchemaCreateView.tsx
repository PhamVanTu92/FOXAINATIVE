'use client';

import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, X, AlertCircle, FileText, Grid3X3,
  Table2, ArrowLeft, Save, ChevronDown, ChevronRight,
  Settings, ScanLine, GripVertical, Bot, Zap,
} from 'lucide-react';
import { useOcrSchemaCreate } from '../hooks/useOcrSchemaCreate';
import { TYPE_OPTIONS, DATA_TYPE_OPTIONS, POSITION_OPTIONS, PROMPT_TEMPLATES } from '../constants';
import type { DocType } from '@/lib/ocr-api';
import { useRoutePermission } from '@/hooks/usePermission';

export function OcrSchemaCreateView() {
  const router = useRouter();
  const {
    code, name, type, aiPrompt, fields, tables, saving, saveError, canSave,
    dragIdx, dragOverIdx, dragColState, dragColOverIdx,
    dragFromHandle, dragColFromHandle,
    setCode, setName, setType, setAiPrompt,
    setDragIdx, setDragOverIdx, setDragColState, setDragColOverIdx,
    addField, updateFieldLabel, updateFieldKey, updateField, removeField, reorderFields,
    addTable, updateTableName, updateTableKey, removeTable, toggleExpand,
    addColumn, updateColumnLabel, updateColumnKey, updateColumn, removeColumn, reorderColumns,
    handleSave,
  } = useOcrSchemaCreate();

  const canCreate = useRoutePermission('CREATE');

  return (
    <div className="min-h-screen bg-subtle">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-surface border-b border-default px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-content-muted mb-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Cấu hình hệ thống</span>
          <ChevronRight className="w-3 h-3" />
          <ScanLine className="w-3.5 h-3.5" />
          <button onClick={() => router.push('/he-thong/ocr')} className="hover:text-primary-500 hover:underline">
            Cấu hình OCR
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-content-secondary font-medium">Tạo mới</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/he-thong/ocr')}
            className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-content-primary">Tạo mới chứng từ OCR</h1>
            <p className="text-xs text-content-muted">Thiết lập cấu hình nhận dạng cho loại chứng từ mới</p>
          </div>
          <button
            onClick={() => router.push('/he-thong/ocr')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary border border-default rounded-lg hover:bg-subtle"
          >
            <X className="w-4 h-4" /> Hủy
          </button>
          {canCreate && (
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-primary text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-50 transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6 space-y-5">
        {saveError && (
          <div className="flex items-center gap-2 bg-danger-50/10 border border-danger-500/30 text-danger-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* ── Card 1: Thông tin chứng từ ── */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-default bg-primary-50">
            <FileText className="w-4 h-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-content-primary">Thông tin chứng từ</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  Mã chứng từ <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_\-]/g, ''))}
                  placeholder="VD: OCR-HDVAT"
                  className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono uppercase bg-surface text-content-primary"
                />
                <p className="text-xs text-content-muted mt-1">Chữ hoa, số, _ và -</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  Tên chứng từ <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="VD: Hóa đơn VAT đầu vào"
                  className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  Loại chứng từ <span className="text-danger-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as DocType)}
                  className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-content-primary"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Các trường OCR ── */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-default bg-primary-50">
            <Grid3X3 className="w-4 h-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-content-primary">
              Các trường OCR
              <span className="ml-1.5 text-xs font-normal text-content-secondary bg-surface px-1.5 py-0.5 rounded-full border border-default">
                {fields.length}
              </span>
            </h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-default bg-success-50/10 text-xs font-semibold text-content-secondary uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left w-12"></th>
                <th className="px-4 py-2.5 text-left">Tên trường</th>
                <th className="px-4 py-2.5 text-left w-48">Field Key</th>
                <th className="px-4 py-2.5 text-left w-36">Kiểu dữ liệu</th>
                <th className="px-4 py-2.5 text-left w-28">Vị trí</th>
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
                  className={`border-b border-default last:border-0 transition-colors ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-primary-400' : ''} ${dragIdx === idx ? 'opacity-40' : 'hover:bg-subtle'}`}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <GripVertical
                        className="w-3.5 h-3.5 text-content-muted cursor-grab active:cursor-grabbing"
                        onMouseDown={() => { dragFromHandle.current = true; }}
                      />
                      <span className="text-content-muted text-xs">{idx + 1}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={f.label}
                      onChange={e => updateFieldLabel(idx, e.target.value)}
                      placeholder="Tên trường *"
                      className={`w-full px-2.5 py-1.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-surface text-content-primary ${!f.label.trim() ? 'border-danger-400 bg-danger-50' : ''}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={f.fieldKey}
                      onChange={e => updateFieldKey(idx, e.target.value)}
                      placeholder="field_key"
                      className="w-full px-2.5 py-1.5 text-xs border border-dashed border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono text-content-secondary bg-subtle"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={f.dataType}
                      onChange={e => updateField(idx, 'dataType', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-surface text-content-primary"
                    >
                      {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={f.position}
                      onChange={e => updateField(idx, 'position', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-surface text-content-primary"
                    >
                      {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeField(idx)}
                      disabled={fields.length === 1}
                      className="p-1.5 text-content-muted hover:text-danger-500 hover:bg-danger-50/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                <td colSpan={6} className="px-4 py-3 border-t border-default bg-subtle">
                  <button
                    onClick={addField}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm trường
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Card 3: Các bảng OCR ── */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-default bg-orange-50">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-content-primary">
                Các bảng OCR
                <span className="ml-1.5 text-xs font-normal text-content-secondary bg-surface px-1.5 py-0.5 rounded-full border border-default">
                  {tables.length}
                </span>
              </h2>
            </div>
            <button
              onClick={addTable}
              className="flex items-center gap-1.5 text-xs font-medium bg-strong hover:bg-subtle text-content-primary border border-default px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm bảng
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Table2 className="w-8 h-8 text-content-muted opacity-50 mx-auto mb-2" />
              <p className="text-sm text-content-muted">Chưa có bảng OCR nào. Nhấn &quot;Thêm bảng&quot; để tạo.</p>
            </div>
          ) : (
            <div className="divide-y divide-default">
              {tables.map((t, tIdx) => (
                <div key={tIdx}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <button onClick={() => toggleExpand(tIdx)} className="text-content-muted hover:text-content-secondary shrink-0">
                      {t.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <Table2 className="w-4 h-4 text-orange-400 shrink-0" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        value={t.name}
                        onChange={e => updateTableName(tIdx, e.target.value)}
                        placeholder="Tên bảng *"
                        className={`flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-surface text-content-primary ${!t.name.trim() ? 'border-danger-400 bg-danger-50' : ''}`}
                      />
                      <input
                        value={t.tableKey}
                        onChange={e => updateTableKey(tIdx, e.target.value)}
                        placeholder="table_key"
                        className="w-40 px-2.5 py-1.5 text-xs border border-dashed border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono text-content-secondary bg-subtle"
                      />
                      <span className="text-xs text-content-muted shrink-0">{t.columns.length} cột</span>
                    </div>
                    <button
                      onClick={() => removeTable(tIdx)}
                      className="p-1.5 text-content-muted hover:text-danger-500 hover:bg-danger-50/10 rounded-lg transition-colors shrink-0"
                      title="Xóa bảng"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {t.expanded && (
                    <div className="mx-5 mb-3 rounded-lg border border-default overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-success-50/10 border-b border-default text-content-secondary uppercase tracking-wide font-semibold">
                            <th className="px-3 py-2 w-8"></th>
                            <th className="px-3 py-2 text-left w-8">#</th>
                            <th className="px-3 py-2 text-left">Tên cột</th>
                            <th className="px-3 py-2 text-left w-40">Column Key</th>
                            <th className="px-3 py-2 text-left w-36">Kiểu dữ liệu</th>
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
                              className={`border-b border-default last:border-0 transition-colors ${
                                dragColOverIdx?.tIdx === tIdx && dragColOverIdx?.cIdx === cIdx && dragColState?.cIdx !== cIdx ? 'border-t-2 border-primary-400' : ''
                              } ${dragColState?.tIdx === tIdx && dragColState?.cIdx === cIdx ? 'opacity-40' : 'hover:bg-subtle'}`}
                            >
                              <td className="px-3 py-2">
                                <GripVertical
                                  className="w-3.5 h-3.5 text-content-muted cursor-grab active:cursor-grabbing"
                                  onMouseDown={() => { dragColFromHandle.current = true; }}
                                />
                              </td>
                              <td className="px-3 py-2 text-content-muted">{cIdx + 1}</td>
                              <td className="px-3 py-2">
                                <input
                                  value={c.label}
                                  onChange={e => updateColumnLabel(tIdx, cIdx, e.target.value)}
                                  placeholder="Tên cột *"
                                  className={`w-full px-2 py-1.5 border border-default rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-surface text-content-primary ${!c.label.trim() ? 'border-danger-400 bg-danger-50' : ''}`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  value={c.columnKey}
                                  onChange={e => updateColumnKey(tIdx, cIdx, e.target.value)}
                                  placeholder="column_key"
                                  className="w-full px-2 py-1.5 text-[11px] border border-dashed border-default rounded focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono text-content-secondary bg-subtle"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={c.dataType}
                                  onChange={e => updateColumn(tIdx, cIdx, 'dataType', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-default rounded bg-surface focus:outline-none focus:ring-1 focus:ring-primary-500 text-content-primary"
                                >
                                  {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => removeColumn(tIdx, cIdx)}
                                  disabled={t.columns.length === 1}
                                  className="p-1 text-content-muted hover:text-danger-400 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                            <td colSpan={6} className="px-3 py-2 border-t border-default bg-subtle">
                              <button
                                onClick={() => addColumn(tIdx)}
                                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-2 py-1 rounded transition-colors"
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

        {/* ── Card 4: Prompt cho AI ── */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-default bg-violet-50">
            <Bot className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-content-primary">Prompt cho AI</h2>
            <span className="ml-1 text-xs text-content-muted font-normal">(áp dụng chung cho toàn bộ chứng từ này)</span>
          </div>
          <div className="p-5">
            <div className="mb-3">
              <p className="text-xs font-medium text-content-secondary mb-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-warning-500" />
                Prompt mẫu cho case khó:
              </p>
              <div className="flex flex-wrap gap-2">
                {PROMPT_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setAiPrompt(prev => prev.trim() ? `${prev.trim()}\n\n${tpl.text}` : tpl.text)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition-colors"
                  >
                    <Zap className="w-3 h-3 text-violet-400" />
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={5}
              placeholder={`Nhập hướng dẫn chung cho AI khi nhận dạng loại chứng từ này.\n\nVD: Đây là phiếu nhập kho nội bộ, không phải hóa đơn VAT.`}
              className="w-full px-3 py-2.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y min-h-[120px] bg-surface text-content-primary placeholder:text-content-muted leading-relaxed"
            />
            <p className="text-xs text-content-muted mt-2">
              Prompt này được đưa vào câu hỏi gửi AI mỗi lần quét tài liệu thuộc loại chứng từ này.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
