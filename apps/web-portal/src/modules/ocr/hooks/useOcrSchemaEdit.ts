'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaDetail, SchemaField, SchemaTable, DataType, FieldPosition, DocType } from '@/lib/ocr-api';
import { toKey } from '../constants';
import { useUIStore } from '@/stores/ui';

export interface FieldEdit { label: string; dataType: DataType; position: FieldPosition; description: string; saving: boolean; }
export interface ColEdit   { label: string; dataType: DataType; description: string; saving: boolean; }
export interface TableEdit { name: string; saving: boolean; }
export interface NewFieldForm { label: string; fieldKey: string; dataType: DataType; position: FieldPosition; description: string; _keyManuallySet: boolean; }
export interface NewTableForm { name: string; initColLabel: string; initColType: DataType; }
export interface PendingCol  { tempId: string; label: string; dataType: DataType; description: string; }

const emptyField = (): NewFieldForm => ({ label: '', fieldKey: '', dataType: 'TEXT', position: 'HEADER', description: '', _keyManuallySet: false });
const emptyTable = (): NewTableForm => ({ name: '', initColLabel: '', initColType: 'TEXT' });

export function useOcrSchemaEdit(id: string) {
  const { showToast, showConfirm } = useUIStore();
  const router = useRouter();

  const [schema, setSchema]       = useState<SchemaDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName]               = useState('');
  const [type, setType]               = useState<DocType>('INVOICE');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive]       = useState(true);
  const [metaSaving, setMetaSaving]   = useState(false);

  const [fieldEdits, setFieldEdits] = useState<Record<string, FieldEdit>>({});
  const [colEdits, setColEdits]     = useState<Record<string, ColEdit>>({});
  const [tableEdits, setTableEdits] = useState<Record<string, TableEdit>>({});
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField]       = useState<NewFieldForm>(emptyField());
  const [fieldAdding, setFieldAdding] = useState(false);

  const [addingTable, setAddingTable] = useState(false);
  const [newTable, setNewTable]       = useState<NewTableForm>(emptyTable());
  const [tableAdding, setTableAdding] = useState(false);

  const [pendingCols, setPendingCols] = useState<Record<string, PendingCol[]>>({});

  const [dragFieldId, setDragFieldId]         = useState<string | null>(null);
  const [dragFieldOverId, setDragFieldOverId] = useState<string | null>(null);
  const dragFieldFromHandle                   = useRef(false);

  const [dragColId, setDragColId]         = useState<string | null>(null);
  const [dragColOverId, setDragColOverId] = useState<string | null>(null);
  const dragColFromHandle                 = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────────

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
      data.fields.forEach(f => {
        fEdits[f.id] = { label: f.label, dataType: f.dataType, position: f.position, description: f.description ?? '', saving: false };
      });
      setFieldEdits(fEdits);

      const tEdits: Record<string, TableEdit> = {};
      const cEdits: Record<string, ColEdit> = {};
      data.tables.forEach(t => {
        tEdits[t.id] = { name: t.name, saving: false };
        t.columns.forEach(c => { cEdits[c.id] = { label: c.label, dataType: c.dataType, description: c.description ?? '', saving: false }; });
      });
      setTableEdits(tEdits);
      setColEdits(cEdits);
    } catch (e: unknown) { setLoadError((e as Error).message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadSchema(); }, [loadSchema]);

  // ── Reorder ───────────────────────────────────────────────────────────────────

  const reorderFieldsLocal = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSchema(prev => {
      if (!prev) return prev;
      const fields = [...prev.fields];
      const fromIdx = fields.findIndex(f => f.id === fromId);
      const toIdx   = fields.findIndex(f => f.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [item] = fields.splice(fromIdx, 1);
      fields.splice(toIdx, 0, item!);
      return { ...prev, fields };
    });
  };

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

  // ── Save metadata + all dirty edits ──────────────────────────────────────────

  const handleSaveMeta = async () => {
    if (!name.trim()) { setSaveError('Vui lòng nhập tên chứng từ.'); return; }
    setMetaSaving(true); setSaveError(null);
    try {
      await ocrApi.updateSchema(id, { name: name.trim(), type, description: description.trim() || undefined, isActive });

      if (schema) {
        const saves: Promise<void>[] = [];

        for (const f of schema.fields) {
          const e = fieldEdits[f.id];
          if (!e || !e.label.trim()) continue;
          const isDirty = e.label !== f.label || e.dataType !== f.dataType || e.position !== f.position || e.description !== (f.description ?? '');
          if (isDirty) {
            saves.push(
              ocrApi.updateField(id, f.id, { label: e.label.trim(), dataType: e.dataType, position: e.position, description: e.description.trim() || undefined }).then(() => {})
            );
          }
        }

        for (const table of schema.tables) {
          const te = tableEdits[table.id];
          if (te && te.name.trim() && te.name !== table.name) {
            saves.push(ocrApi.updateTable(id, table.id, { name: te.name.trim() }).then(() => {}));
          }
          for (const col of table.columns) {
            const e = colEdits[col.id];
            if (!e || !e.label.trim()) continue;
            const isDirty = e.label !== col.label || e.dataType !== col.dataType || e.description !== (col.description ?? '');
            if (isDirty) {
              saves.push(
                ocrApi.updateTableColumn(id, table.id, col.id, { label: e.label.trim(), dataType: e.dataType, description: e.description || undefined }).then(() => {})
              );
            }
          }
          for (const pc of (pendingCols[table.id] ?? []).filter(pc => pc.label.trim())) {
            saves.push(
              ocrApi.addTableColumn(id, table.id, { columnKey: toKey(pc.label), label: pc.label.trim(), dataType: pc.dataType, isRequired: false, description: pc.description || undefined }).then(() => {})
            );
          }
        }

        await Promise.all(saves);
        setPendingCols({});
      }

      router.push('/he-thong/ocr');
    } catch (e: unknown) { setSaveError((e as Error).message); }
    finally { setMetaSaving(false); }
  };

  // ── Field add / remove ────────────────────────────────────────────────────────

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

  const handleRemoveField = async (field: SchemaField) => {
    showConfirm({
      title: `Xóa trường "${field.label}"`,
      body: `Xóa trường "${field.label}"? Hành động này không thể hoàn tác.`,
      onOk: async () => {
        try {
          await ocrApi.removeField(id, field.id);
          setSchema(prev => prev ? { ...prev, fields: prev.fields.filter(f => f.id !== field.id) } : prev);
          setFieldEdits(prev => { const next = { ...prev }; delete next[field.id]; return next; });
        } catch (e: unknown) { showToast((e as Error).message, 'error'); }
      },
    });
    return;
  };

  // ── Table add / remove ────────────────────────────────────────────────────────

  const handleAddTable = async () => {
    if (!newTable.name.trim() || !newTable.initColLabel.trim()) { setSaveError('Vui lòng nhập tên bảng và cột đầu tiên.'); return; }
    setTableAdding(true);
    try {
      const added = await ocrApi.addTable(id, { tableKey: toKey(newTable.name), name: newTable.name.trim(), columns: [{ columnKey: toKey(newTable.initColLabel), label: newTable.initColLabel.trim(), dataType: newTable.initColType }] });
      setSchema(prev => prev ? { ...prev, tables: [...prev.tables, added] } : prev);
      setExpandedTables(prev => new Set([...prev, added.id]));
      setTableEdits(prev => ({ ...prev, [added.id]: { name: added.name, saving: false } }));
      added.columns.forEach(c => { setColEdits(prev => ({ ...prev, [c.id]: { label: c.label, dataType: c.dataType, description: c.description ?? '', saving: false } })); });
      setAddingTable(false); setNewTable(emptyTable());
    } catch (e: unknown) { setSaveError((e as Error).message); }
    finally { setTableAdding(false); }
  };

  const handleRemoveTable = async (table: SchemaTable) => {
    showConfirm({
      title: `Xóa bảng "${table.name}"`,
      body: `Xóa bảng "${table.name}"? Hành động này không thể hoàn tác.`,
      onOk: async () => {
        try {
          await ocrApi.removeTable(id, table.id);
          setSchema(prev => prev ? { ...prev, tables: prev.tables.filter(t => t.id !== table.id) } : prev);
        } catch (e: unknown) { showToast((e as Error).message, 'error'); }
      },
    });
    return;
  };

  const toggleExpand = (tableId: string) =>
    setExpandedTables(prev => { const next = new Set(prev); next.has(tableId) ? next.delete(tableId) : next.add(tableId); return next; });

  // ── Pending columns ───────────────────────────────────────────────────────────

  const addPendingCol = (tableId: string) => {
    const tempId = `pending_${Date.now()}_${Math.random()}`;
    setPendingCols(prev => ({ ...prev, [tableId]: [...(prev[tableId] ?? []), { tempId, label: '', dataType: 'TEXT', description: '' }] }));
    setExpandedTables(prev => new Set([...prev, tableId]));
  };

  const updatePendingCol = (tableId: string, tempId: string, patch: Partial<PendingCol>) =>
    setPendingCols(prev => ({ ...prev, [tableId]: (prev[tableId] ?? []).map(pc => pc.tempId === tempId ? { ...pc, ...patch } : pc) }));

  const removePendingCol = (tableId: string, tempId: string) =>
    setPendingCols(prev => ({ ...prev, [tableId]: (prev[tableId] ?? []).filter(pc => pc.tempId !== tempId) }));

  // ── Column remove ─────────────────────────────────────────────────────────────

  const handleRemoveColumn = async (tableId: string, columnId: string, label: string) => {
    showConfirm({
      title: `Xóa cột "${label}"`,
      body: `Xóa cột "${label}"? Hành động này không thể hoàn tác.`,
      onOk: async () => {
        try {
          await ocrApi.removeTableColumn(id, tableId, columnId);
          setSchema(prev => {
            if (!prev) return prev;
            return { ...prev, tables: prev.tables.map(t => t.id === tableId ? { ...t, columns: t.columns.filter(c => c.id !== columnId) } : t) };
          });
          setColEdits(prev => { const next = { ...prev }; delete next[columnId]; return next; });
        } catch (e: unknown) { showToast((e as Error).message, 'error'); }
      },
    });
    return;
  };

  // ── Validation ────────────────────────────────────────────────────────────────

  const canSave =
    name.trim() !== '' &&
    !(schema?.fields.some(f => { const e = fieldEdits[f.id]; return e !== undefined && !e.label.trim(); })) &&
    !(schema?.tables.some(t => { const te = tableEdits[t.id]; return te !== undefined && !te.name.trim(); })) &&
    !(schema?.tables.some(t => t.columns.some(c => { const ce = colEdits[c.id]; return ce !== undefined && !ce.label.trim(); }))) &&
    !(addingField && !newField.label.trim()) &&
    !(addingTable && (!newTable.name.trim() || !newTable.initColLabel.trim())) &&
    !Object.values(pendingCols).flat().some(pc => !pc.label.trim());

  return {
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
    loadSchema, reorderFieldsLocal, reorderColumnsLocal,
    handleSaveMeta, handleAddField, handleRemoveField,
    handleAddTable, handleRemoveTable, toggleExpand,
    addPendingCol, updatePendingCol, removePendingCol, handleRemoveColumn,
  };
}
