'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { knowledgeDocumentsApi } from '@/lib/knowledge-api';
import type { KnowledgeDocument, DocStatus, DocumentVersion } from '@/lib/knowledge-api';

export type DocDetailTab = 'info' | 'versions' | 'compare';

export function useKiemDuyet() {
  const [allDocs, setAllDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatus | ''>('');

  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DocDetailTab>('info');

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await knowledgeDocumentsApi.list({ pageSize: 100 });
      setAllDocs(res.items);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const documents = useMemo(() => {
    return allDocs.filter(d => {
      const matchStatus = !statusFilter || d.status === statusFilter;
      const matchSearch = !search ||
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.knowledgeBaseName?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [allDocs, search, statusFilter]);

  const counts = useMemo(() => ({
    all: allDocs.length,
    draft: allDocs.filter(d => d.status === 'Draft').length,
    review: allDocs.filter(d => d.status === 'Review').length,
    approved: allDocs.filter(d => d.status === 'Approved').length,
    archived: allDocs.filter(d => d.status === 'Archived').length,
  }), [allDocs]);

  const handleSelectDoc = useCallback(async (doc: KnowledgeDocument) => {
    setSelectedDoc(doc);
    setActiveTab('info');
    setVersions([]);
    setVersionsLoading(true);
    try {
      const versRes = await knowledgeDocumentsApi.versions(doc.id);
      setVersions(versRes.items);
    } catch {
      // non-fatal
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function updateDoc(updated: KnowledgeDocument) {
    setAllDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
    setSelectedDoc(updated);
  }

  async function handleApprove() {
    if (!selectedDoc) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await knowledgeDocumentsApi.approve(selectedDoc.id);
      updateDoc(updated);
      showSuccess('Đã phê duyệt và publish thành công');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReturnDraft() {
    if (!selectedDoc) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await knowledgeDocumentsApi.returnDraft(selectedDoc.id);
      updateDoc(updated);
      showSuccess('Đã trả về Draft');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestRevision() {
    if (!selectedDoc || !revisionNote.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await knowledgeDocumentsApi.requestRevision(selectedDoc.id, revisionNote);
      updateDoc(updated);
      setShowRevisionModal(false);
      setRevisionNote('');
      showSuccess('Đã gửi yêu cầu chỉnh sửa');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRollback() {
    if (!selectedDoc) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await knowledgeDocumentsApi.rollback(selectedDoc.id);
      updateDoc(updated);
      // reload versions after rollback
      const versRes = await knowledgeDocumentsApi.versions(selectedDoc.id);
      setVersions(versRes.items);
      showSuccess('Đã rollback phiên bản thành công');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  return {
    documents, loading, error, successMsg,
    search, setSearch,
    statusFilter, setStatusFilter,
    counts,
    selectedDoc, handleSelectDoc,
    versions, versionsLoading,
    activeTab, setActiveTab,
    actionLoading,
    showRevisionModal, setShowRevisionModal,
    revisionNote, setRevisionNote,
    handleApprove, handleReturnDraft, handleRequestRevision, handleRollback,
  };
}
