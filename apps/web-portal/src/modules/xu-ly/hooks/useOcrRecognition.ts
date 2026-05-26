'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaDetail, DocDetail, LineItem, SseEvent } from '@/lib/ocr-api';

export type QueueStatus = 'uploading' | 'queued' | 'processing' | 'done' | 'error';

export interface QueueItem {
  localId: string;
  files: File[];
  status: QueueStatus;
  documentId?: string;
  doc?: DocDetail;
  fieldValues: Record<string, string>;
  lineItems: LineItem[];
  dirty: boolean;
  errorMsg?: string;
}

export function useOcrRecognition(schemaCode: string) {
  const router = useRouter();

  const [schema, setSchema]               = useState<SchemaDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError]     = useState<string | null>(null);

  const [ocrProvider, setOcrProvider]       = useState<string>('gemini');
  const [dragging, setDragging]             = useState(false);
  const [queue, setQueue]                   = useState<QueueItem[]>([]);
  const [activeId, setActiveId]             = useState<string | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [confirming, setConfirming]         = useState(false);
  const [focusedCellKey, setFocusedCellKey] = useState<string | null>(null);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  const activeItem   = queue.find(q => q.localId === activeId) ?? null;
  const doc          = activeItem?.doc ?? null;
  const fieldValues  = activeItem?.fieldValues ?? {};
  const lineItems    = activeItem?.lineItems ?? [];
  const dirty        = activeItem?.dirty ?? false;
  const isUploading  = activeItem?.status === 'uploading';
  const isPolling    = activeItem?.status === 'queued' || activeItem?.status === 'processing';
  const isProcessing = isUploading || isPolling;
  const anyProcessing = queue.some(q => q.status === 'uploading' || q.status === 'queued' || q.status === 'processing');

  useEffect(() => {
    ocrApi.getSchemaByCode(schemaCode)
      .then(s => setSchema(s))
      .catch(e => setSchemaError((e as Error).message))
      .finally(() => setSchemaLoading(false));
  }, [schemaCode]);

  useEffect(() => () => { eventSourcesRef.current.forEach(es => es.close()); }, []);

  const updateItem = useCallback((localId: string, patch: Partial<QueueItem>) => {
    setQueue(prev => prev.map(q => q.localId === localId ? { ...q, ...patch } : q));
  }, []);

  const removeItem = useCallback((localId: string) => {
    const es = eventSourcesRef.current.get(localId);
    if (es) { es.close(); eventSourcesRef.current.delete(localId); }
    setQueue(prev => prev.filter(q => q.localId !== localId));
    setActiveId(prev => prev === localId ? null : prev);
  }, []);

  const startSSE = useCallback((localId: string, docId: string) => {
    const es = new EventSource(ocrApi.getDocumentSseUrl(docId));
    eventSourcesRef.current.set(localId, es);

    es.onmessage = (event: MessageEvent<string>) => {
      let data: SseEvent;
      try { data = JSON.parse(event.data) as SseEvent; } catch { return; }

      if (data.type === 'done') {
        es.close();
        eventSourcesRef.current.delete(localId);
        const vals: Record<string, string> = {};
        for (const v of data.document.values) vals[v.fieldId] = v.stringValue ?? '';
        updateItem(localId, {
          status: 'done', doc: data.document,
          fieldValues: vals, lineItems: [...data.document.lineItems], dirty: false,
        });
        setActiveId(prev => prev ?? localId);
      } else if (data.type === 'failed') {
        es.close();
        eventSourcesRef.current.delete(localId);
        updateItem(localId, { status: 'error', errorMsg: data.error });
      } else if (data.type === 'progress') {
        updateItem(localId, { status: 'processing' });
      }
    };

    es.onerror = () => {
      es.close();
      eventSourcesRef.current.delete(localId);
      updateItem(localId, { status: 'error', errorMsg: 'Mất kết nối khi theo dõi tiến trình OCR.' });
    };
  }, [updateItem]);

  const triggerOCR = useCallback(async (localId: string, files: File[], s: SchemaDetail, provider: string) => {
    try {
      const res = await ocrApi.uploadDocument(files, s.id, 'vi+en', provider);
      updateItem(localId, { status: 'queued', documentId: res.documentId });
      startSSE(localId, res.documentId);
    } catch (e: unknown) {
      updateItem(localId, { status: 'error', errorMsg: (e as Error).message });
    }
  }, [updateItem, startSSE]);

  const acceptFiles = useCallback((files: File[]) => {
    if (!schema || files.length === 0) return;
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newItem: QueueItem = {
      localId, files, status: 'uploading',
      fieldValues: {}, lineItems: [], dirty: false,
    };
    setQueue(prev => [...prev, newItem]);
    setActiveId(prev => prev ?? localId);
    triggerOCR(localId, files, schema, ocrProvider);
  }, [schema, ocrProvider, triggerOCR]);

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) acceptFiles(files);
  };

  const setFieldValue = useCallback((fieldId: string, value: string) => {
    if (!activeId) return;
    setQueue(prev => prev.map(q =>
      q.localId === activeId ? { ...q, fieldValues: { ...q.fieldValues, [fieldId]: value }, dirty: true } : q,
    ));
  }, [activeId]);

  const setLineItemsForActive = useCallback((updater: (prev: LineItem[]) => LineItem[]) => {
    if (!activeId) return;
    setQueue(prev => prev.map(q =>
      q.localId === activeId ? { ...q, lineItems: updater(q.lineItems), dirty: true } : q,
    ));
  }, [activeId]);

  const addLineItem = (tableKey?: string) => {
    setLineItemsForActive(prev => {
      const stt = prev.length ? Math.max(...prev.map(li => li.stt)) + 1 : 1;
      return [...prev, { id: '', stt, tableKey: tableKey ?? null, name: '', unit: '', quantity: null, unitPrice: null, amount: null, isManuallyAdded: true }];
    });
  };

  const removeLineItem = (stt: number) => setLineItemsForActive(prev => prev.filter(li => li.stt !== stt));

  const updateLi = <K extends keyof LineItem>(stt: number, key: K, value: LineItem[K]) =>
    setLineItemsForActive(prev => prev.map(li => li.stt === stt ? { ...li, [key]: value } : li));

  const updateLiExtra = (stt: number, colKey: string, value: string) =>
    setLineItemsForActive(prev => prev.map(li =>
      li.stt === stt ? { ...li, extraData: { ...(li.extraData ?? {}), [colKey]: value } } : li,
    ));

  const handleSave = async () => {
    if (!doc || !activeId) return;
    setSaving(true);
    try {
      const updated = await ocrApi.updateDocument(doc.id, {
        values: Object.entries(fieldValues).map(([fieldId, stringValue]) => ({ fieldId, stringValue })),
        lineItems: lineItems.map(({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData }) =>
          ({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData })),
      });
      updateItem(activeId, { doc: updated, dirty: false });
    } catch (e: unknown) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSaveAndExit = async () => {
    if (!doc || !activeId) return;
    setConfirming(true);
    try {
      if (dirty) {
        const updated = await ocrApi.updateDocument(doc.id, {
          values: Object.entries(fieldValues).map(([fieldId, stringValue]) => ({ fieldId, stringValue })),
          lineItems: lineItems.map(({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData }) =>
            ({ stt, tableKey, name, unit, quantity, unitPrice, amount, extraData })),
        });
        updateItem(activeId, { doc: updated, dirty: false });
      }
      router.push('/xu-ly/chung-tu');
    } catch (e: unknown) { console.error(e); }
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

  const arithmeticWarnings = useMemo(() => {
    const w = { lineItems: new Set<number>(), fields: new Set<string>() };
    if (!doc || !schema || isProcessing) return w;
    for (const li of lineItems) {
      if (li.quantity != null && li.unitPrice != null && li.amount != null) {
        if (Math.abs(li.quantity * li.unitPrice - li.amount) > 1) w.lineItems.add(li.stt);
      }
    }
    const fid = (key: string) => schema.fields.find(f => f.fieldKey === key)?.id;
    const fTotal = fid('totalAmount'); const fVat = fid('vatAmount'); const fGrand = fid('grandTotal');
    const parseNum = (id: string | undefined) => {
      if (!id) return null;
      const n = parseFloat((fieldValues[id] ?? '').replace(/[^\d.-]/g, ''));
      return isNaN(n) ? null : n;
    };
    const total = parseNum(fTotal); const vat = parseNum(fVat); const grand = parseNum(fGrand);
    if (fTotal && total != null && lineItems.length > 0) {
      const sum = lineItems.reduce((acc, li) => acc + (li.amount ?? 0), 0);
      if (Math.abs(sum - total) > 1) w.fields.add(fTotal);
    }
    if (total != null && vat != null && grand != null && Math.abs(total + vat - grand) > 1) {
      if (fTotal) w.fields.add(fTotal); if (fVat) w.fields.add(fVat); if (fGrand) w.fields.add(fGrand);
    }
    return w;
  }, [doc, schema, lineItems, fieldValues, isProcessing]);

  return {
    schema, schemaLoading, schemaError,
    ocrProvider, setOcrProvider, dragging, queue, activeId, setActiveId,
    saving, confirming, focusedCellKey, setFocusedCellKey,
    fileInputRef,
    activeItem, doc, fieldValues, lineItems, dirty,
    isUploading, isPolling, isProcessing, anyProcessing,
    arithmeticWarnings,
    hasArithmeticWarnings: arithmeticWarnings.lineItems.size > 0 || arithmeticWarnings.fields.size > 0,
    acceptFiles, removeItem, onDragOver, onDragLeave, onDrop,
    setFieldValue, addLineItem, removeLineItem, updateLi, updateLiExtra,
    handleSave, handleSaveAndExit, handleExport,
  };
}
