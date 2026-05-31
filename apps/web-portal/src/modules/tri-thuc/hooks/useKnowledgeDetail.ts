'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { knowledgeBasesApi, knowledgeFilesApi } from '@/lib/knowledge-api';
import type { KnowledgeBase, KnowledgeFile, DepartmentRef, CreateKbPayload } from '@/lib/knowledge-api';
import { orgsApi } from '@/lib/users-api';
import type { OrgNode } from '@/lib/users-api';

function flattenOrgTree(nodes: OrgNode[]): DepartmentRef[] {
  const result: DepartmentRef[] = [];
  function walk(list: OrgNode[]) {
    for (const n of list) {
      result.push({ departmentId: n.id, departmentName: n.name });
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

export function useKnowledgeDetail(kbId: string) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [allFiles, setAllFiles] = useState<KnowledgeFile[]>([]);
  const [orgDepts, setOrgDepts] = useState<DepartmentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<KnowledgeFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [permFile, setPermFile] = useState<KnowledgeFile | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [kbRes, filesRes, orgRes] = await Promise.all([
        knowledgeBasesApi.get(kbId),
        knowledgeFilesApi.list(kbId, { pageSize: 100 }),
        orgsApi.tree(),
      ]);
      setKb(kbRes);
      setAllFiles(filesRes.items);
      setOrgDepts(flattenOrgTree(orgRes.nodes ?? []));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => { load(); }, [load]);

  const files = useMemo(() =>
    allFiles.filter(f => {
      const matchType = !fileTypeFilter || f.fileType === fileTypeFilter;
      const matchSearch = !search || f.fileName.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    }),
    [allFiles, search, fileTypeFilter]
  );

  const typeCounts = useMemo(() => ({
    Word:  allFiles.filter(f => f.fileType === 'Word').length,
    Excel: allFiles.filter(f => f.fileType === 'Excel').length,
    PDF:   allFiles.filter(f => f.fileType === 'PDF').length,
    Image: allFiles.filter(f => f.fileType === 'Image').length,
  }), [allFiles]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function reloadKb() {
    const updated = await knowledgeBasesApi.get(kbId);
    setKb(updated);
  }

  async function uploadFile(file: File, fileType: string) {
    setUploading(true);
    setError('');
    try {
      const created = await knowledgeFilesApi.add(kbId, {
        file,
        fileName: file.name,
        fileType,
      });
      setAllFiles(prev => [...prev, created]);
      setShowUpload(false);
      showSuccess('Đã tải lên tệp thành công');
      await reloadKb();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function saveFilePermissions(fileId: string, departments: import('@/lib/knowledge-api').DepartmentRef[]) {
    setSavingPermissions(true);
    setError('');
    try {
      const updated = await knowledgeFilesApi.updatePermissions(kbId, fileId, departments);
      setAllFiles(prev => prev.map(f => f.id === fileId ? updated : f));
      setPermFile(null);
      showSuccess('Đã cập nhật phân quyền');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSavingPermissions(false);
    }
  }

  async function confirmDelete() {
    if (!deletingFile) return;
    setDeleting(true);
    setError('');
    try {
      await knowledgeFilesApi.unlink(deletingFile.id);
      setAllFiles(prev => prev.filter(f => f.id !== deletingFile.id));
      setDeletingFile(null);
      showSuccess('Đã gỡ tệp khỏi bộ tri thức');
      await reloadKb();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const [showEditKb, setShowEditKb] = useState(false);
  const [savingKb, setSavingKb] = useState(false);

  async function updateKb(dto: Omit<CreateKbPayload, 'code'>) {
    if (!kb) return;
    setSavingKb(true);
    setError('');
    try {
      const updated = await knowledgeBasesApi.update(kb.id, dto);
      setKb(updated);
      setShowEditKb(false);
      showSuccess('Đã cập nhật bộ tri thức');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSavingKb(false);
    }
  }

  return {
    kb, files, allFiles, loading, error, successMsg,
    search, setSearch,
    fileTypeFilter, setFileTypeFilter,
    typeCounts,
    showUpload, setShowUpload,
    uploading, uploadFile,
    deletingFile, setDeletingFile,
    deleting, confirmDelete,
    permFile, setPermFile,
    savingPermissions, saveFilePermissions,
    orgDepts,
    showEditKb, setShowEditKb,
    savingKb, updateKb,
  };
}
