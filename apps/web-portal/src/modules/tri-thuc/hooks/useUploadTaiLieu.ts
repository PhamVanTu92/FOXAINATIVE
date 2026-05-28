'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { knowledgeBasesApi, knowledgeDocumentsApi, KnowledgeBase, FileType } from '@/lib/knowledge-api';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface QueueItem {
  id: string;
  file: File;
  fileName: string;
  fileType: FileType;
  fileSizeMb: number;
  knowledgeBaseId: string;
  title: string;
  contentSummary: string;
  status: UploadStatus;
  errorMsg?: string;
}

function detectFileType(name: string): FileType {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'Word';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Excel';
  if (['ppt', 'pptx'].includes(ext)) return 'PowerPoint';
  if (ext === 'txt') return 'Text';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image';
  return 'Text';
}

export function useUploadTaiLieu() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [kbList, setKbList] = useState<KnowledgeBase[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadKbs = useCallback(async () => {
    try {
      const res = await knowledgeBasesApi.list({ pageSize: 100 });
      setKbList(res.items);
    } catch {
      // non-blocking — KB list is optional
    } finally {
      setKbLoading(false);
    }
  }, []);

  useEffect(() => { loadKbs(); }, [loadKbs]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    setQueue(prev => {
      const defaultKbId = kbList[0]?.id ?? '';
      const newItems: QueueItem[] = arr.map(f => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        fileName: f.name,
        fileType: detectFileType(f.name),
        fileSizeMb: +(f.size / 1024 / 1024).toFixed(2),
        knowledgeBaseId: defaultKbId,
        title: f.name.replace(/\.[^.]+$/, ''),
        contentSummary: '',
        status: 'pending',
      }));
      return [...prev, ...newItems];
    });
  }, [kbList]);

  const removeItem = useCallback((id: string) => {
    setQueue(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateItem = useCallback((
    id: string,
    patch: Partial<Pick<QueueItem, 'knowledgeBaseId' | 'title' | 'contentSummary'>>,
  ) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  const processOne = useCallback(async (item: QueueItem): Promise<boolean> => {
    if (!item.knowledgeBaseId || !item.title.trim()) {
      setQueue(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, status: 'error' as UploadStatus, errorMsg: 'Chọn bộ tri thức và nhập tiêu đề' }
          : i,
      ));
      return false;
    }
    setQueue(prev => prev.map(i =>
      i.id === item.id ? { ...i, status: 'uploading' as UploadStatus, errorMsg: undefined } : i,
    ));
    try {
      await knowledgeDocumentsApi.create({
        knowledgeBaseId: item.knowledgeBaseId,
        title: item.title.trim(),
        file: item.file,
        fileType: item.fileType,
        contentSummary: item.contentSummary || undefined,
      });
      setQueue(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'done' as UploadStatus } : i,
      ));
      return true;
    } catch (e) {
      setQueue(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, status: 'error' as UploadStatus, errorMsg: (e as Error).message }
          : i,
      ));
      return false;
    }
  }, []);

  const processAll = useCallback(async () => {
    const toProcess = queue.filter(i => i.status === 'pending' || i.status === 'error');
    if (!toProcess.length || processing) return;
    setProcessing(true);
    let count = 0;
    for (const item of toProcess) {
      if (await processOne(item)) count++;
    }
    setProcessing(false);
    if (count > 0) {
      setSuccessMsg(`Upload thành công ${count} tài liệu`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }, [queue, processing, processOne]);

  const clearDone = useCallback(() => {
    setQueue(prev => prev.filter(i => i.status !== 'done'));
  }, []);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as Element).contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  }, [addFiles]);

  return {
    queue,
    kbList,
    kbLoading,
    isDragging,
    processing,
    successMsg,
    inputRef,
    pendingCount: queue.filter(i => i.status === 'pending').length,
    errorCount: queue.filter(i => i.status === 'error').length,
    doneCount: queue.filter(i => i.status === 'done').length,
    totalCount: queue.length,
    addFiles,
    removeItem,
    updateItem,
    processOne,
    processAll,
    clearDone,
    openFilePicker,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInput,
  };
}
