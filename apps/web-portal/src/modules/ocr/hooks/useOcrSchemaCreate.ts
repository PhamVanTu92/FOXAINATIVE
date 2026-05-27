'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ocrApi } from '@/lib/ocr-api';
import type { DataType, FieldPosition, DocType } from '@/lib/ocr-api';
import { toKey } from '../constants';

export interface FieldRow {
  label: string;
  fieldKey: string;
  dataType: DataType;
  position: FieldPosition;
  isRequired: boolean;
  _keyManuallySet: boolean;
}

export interface ColumnRow {
  label: string;
  columnKey: string;
  dataType: DataType;
  isRequired: boolean;
  _keyManuallySet: boolean;
}

export interface TableRow {
  name: string;
  tableKey: string;
  columns: ColumnRow[];
  expanded: boolean;
  _keyManuallySet: boolean;
}

const newFieldRow = (): FieldRow => ({
  label: '', fieldKey: '', dataType: 'TEXT', position: 'HEADER',
  isRequired: false, _keyManuallySet: false,
});

const newColumnRow = (): ColumnRow => ({
  label: '', columnKey: '', dataType: 'TEXT', isRequired: false, _keyManuallySet: false,
});

export function useOcrSchemaCreate() {
  const router = useRouter();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<DocType>('INVOICE');
  const [aiPrompt, setAiPrompt] = useState('');
  const [fields, setFields] = useState<FieldRow[]>([newFieldRow()]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragFromHandle = useRef(false);

  const [dragColState, setDragColState] = useState<{ tIdx: number; cIdx: number } | null>(null);
  const [dragColOverIdx, setDragColOverIdx] = useState<{ tIdx: number; cIdx: number } | null>(null);
  const dragColFromHandle = useRef(false);

  // ── Field drag ───────────────────────────────────────────────────────────────

  const reorderFields = (from: number, to: number) => {
    if (from === to) return;
    setFields(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item!);
      return arr;
    });
  };

  // ── Column drag ──────────────────────────────────────────────────────────────

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

  const addField = () => setFields(prev => [...prev, newFieldRow()]);

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
    name: '', tableKey: '', expanded: true, _keyManuallySet: false, columns: [newColumnRow()],
  }]);

  const updateTableName = (tIdx: number, val: string) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, name: val, tableKey: t._keyManuallySet ? t.tableKey : toKey(val),
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
      ...t, expanded: true, columns: [...t.columns, newColumnRow()],
    }));

  const updateColumnLabel = (tIdx: number, cIdx: number, val: string) =>
    setTables(prev => prev.map((t, i) => i !== tIdx ? t : {
      ...t, columns: t.columns.map((c, j) => j !== cIdx ? c : {
        ...c, label: val, columnKey: c._keyManuallySet ? c.columnKey : toKey(val),
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
    if (fields.some(f => !f.label.trim())) { setSaveError('Vui lòng nhập tên cho tất cả các trường OCR.'); return; }
    for (const t of tables) {
      if (!t.name.trim()) { setSaveError('Vui lòng nhập tên cho tất cả các bảng OCR.'); return; }
      if (t.columns.some(c => !c.label.trim())) { setSaveError(`Bảng "${t.name}" còn cột chưa nhập tên. Vui lòng nhập đầy đủ.`); return; }
    }
    const validFields = fields.filter(f => f.label.trim() && f.fieldKey.trim());
    if (validFields.length === 0) { setSaveError('Cần ít nhất 1 trường OCR hợp lệ.'); return; }

    const fkSeen = new Set<string>();
    for (const f of validFields) {
      if (fkSeen.has(f.fieldKey)) { setSaveError(`Field Key "${f.fieldKey}" bị trùng lặp — mỗi trường phải có Field Key duy nhất.`); return; }
      fkSeen.add(f.fieldKey);
    }

    const validTables = tables
      .map(t => ({ ...t, columns: t.columns.filter(c => c.label.trim() && c.columnKey.trim()) }))
      .filter(t => t.name.trim() && t.tableKey.trim() && t.columns.length > 0);

    setSaving(true);
    try {
      await ocrApi.createSchema({
        code: code.toUpperCase().trim(),
        name: name.trim(),
        type,
        description: aiPrompt.trim() || undefined,
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

  const canSave =
    code.trim() !== '' &&
    name.trim() !== '' &&
    fields.every(f => f.label.trim() !== '') &&
    tables.every(t => t.name.trim() !== '' && t.columns.every(c => c.label.trim() !== ''));

  return {
    code, name, type, aiPrompt, fields, tables, saving, saveError, canSave,
    dragIdx, dragOverIdx, dragColState, dragColOverIdx,
    dragFromHandle, dragColFromHandle,
    setCode, setName, setType, setAiPrompt,
    setDragIdx, setDragOverIdx, setDragColState, setDragColOverIdx,
    addField, updateFieldLabel, updateFieldKey, updateField, removeField, reorderFields,
    addTable, updateTableName, updateTableKey, removeTable, toggleExpand,
    addColumn, updateColumnLabel, updateColumnKey, updateColumn, removeColumn, reorderColumns,
    handleSave,
  };
}
