'use client';

import { useState, useCallback, useRef } from 'react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocDetail } from '@/lib/ocr-api';

export function useDocumentDetail(showToast: (msg: string, type?: 'error' | 'success') => void) {
  const [detailOpen, setDetailOpen]       = useState(false);
  const [detailDoc, setDetailDoc]         = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [panelWidth, setPanelWidth]       = useState(480);
  const [isDragging, setIsDragging]       = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = { startX: e.clientX, startWidth: panelWidth };
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = dragStartRef.current.startX - ev.clientX;
      setPanelWidth(Math.max(320, Math.min(800, dragStartRef.current.startWidth + delta)));
    };
    const onMouseUp = () => {
      dragStartRef.current = null;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  const openDetailPanel = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailDoc(null);
    setActiveFileIdx(0);
    try {
      setDetailDoc(await ocrApi.getDocument(id));
    } catch (e: unknown) {
      showToast((e as Error).message);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  return {
    detailOpen, setDetailOpen, detailDoc, detailLoading,
    activeFileIdx, setActiveFileIdx, panelWidth, isDragging,
    handleDividerMouseDown, openDetailPanel,
  };
}
