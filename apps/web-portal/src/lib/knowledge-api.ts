const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api`;

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? `HTTP ${res.status}`);
  return json as T;
}

async function reqMultipart<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeader(),
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? `HTTP ${res.status}`);
  return json as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepartmentRef {
  departmentId: string;
  departmentName: string;
}

export interface KbFileCounts {
  word: number;
  excel: number;
  pdf: number;
  image: number;
}

export interface KnowledgeBase {
  id: string;
  code: string;
  name: string;
  description?: string;
  managingDepartmentId: string;
  managingDepartmentName: string;
  permissions: DepartmentRef[];
  fileCounts: KbFileCounts;
  totalFiles: number;
  createdAt: string;
  updatedAt: string;
}

export interface KbGlobalStats {
  totalKnowledgeBases: number;
  totalFiles: number;
  departmentsUsingCount: number;
  lastUpdatedAt: string;
}

export interface KnowledgeFile {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSizeMb: number;
  storagePath: string;
  uploadedAt: string;
  updatedAt: string;
  permissions: DepartmentRef[];
}

export type DocStatus = 'Draft' | 'Review' | 'Approved' | 'Archived';
export type FileType = 'Word' | 'Excel' | 'PDF' | 'Image' | 'PowerPoint' | 'Text';

export interface KnowledgeDocument {
  id: string;
  title: string;
  status: DocStatus;
  fileType: FileType;
  currentVersion: string;
  versionCount: number;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  authorId: string;
  authorName: string;
  contentSummary?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
}

export interface DocumentVersion {
  id: string;
  version: string;
  changeNote: string;
  authorName: string;
  createdAt: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateKbPayload {
  code: string;
  name: string;
  description?: string;
  managingDepartmentId: string;
  managingDepartmentName: string;
  permittedDepartments?: DepartmentRef[];
}

// ─── Knowledge Bases ──────────────────────────────────────────────────────────

export const knowledgeBasesApi = {
  stats: () =>
    req<KbGlobalStats>('/knowledge-bases/stats'),

  list: (params?: { search?: string; departmentId?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.departmentId) q.set('departmentId', params.departmentId);
    if (params?.page) q.set('page', String(params.page));
    q.set('pageSize', String(params?.pageSize ?? 50));
    return req<PagedResult<KnowledgeBase>>(`/knowledge-bases?${q}`);
  },

  get: (id: string) =>
    req<KnowledgeBase>(`/knowledge-bases/${id}`),

  create: (dto: CreateKbPayload) =>
    req<KnowledgeBase>('/knowledge-bases', { method: 'POST', body: JSON.stringify(dto) }),

  update: (id: string, dto: Omit<CreateKbPayload, 'code'>) =>
    req<KnowledgeBase>(`/knowledge-bases/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),

  remove: (id: string) =>
    req<void>(`/knowledge-bases/${id}`, { method: 'DELETE' }),
};

// ─── Knowledge Files ──────────────────────────────────────────────────────────

export const knowledgeFilesApi = {
  list: (kbId: string, params?: { search?: string; fileType?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.fileType) q.set('fileType', params.fileType);
    if (params?.page) q.set('page', String(params.page));
    q.set('pageSize', String(params?.pageSize ?? 100));
    return req<PagedResult<KnowledgeFile>>(`/knowledge-bases/${kbId}/files?${q}`);
  },

  get: (kbId: string, fileId: string) =>
    req<KnowledgeFile>(`/knowledge-bases/${kbId}/files/${fileId}`),

  add: (kbId: string, file: File, payload: { fileType?: string; permittedDepartments?: DepartmentRef[] }) => {
    const form = new FormData();
    form.append('file', file);
    if (payload.fileType) form.append('fileType', payload.fileType);
    if (payload.permittedDepartments)
      form.append('permittedDepartments', JSON.stringify(payload.permittedDepartments));
    return reqMultipart<KnowledgeFile>(`/knowledge-bases/${kbId}/files`, form);
  },

  remove: (kbId: string, fileId: string) =>
    req<void>(`/knowledge-bases/${kbId}/files/${fileId}`, { method: 'DELETE' }),

  updatePermissions: (kbId: string, fileId: string, permittedDepartments: DepartmentRef[]) =>
    req<KnowledgeFile>(`/knowledge-bases/${kbId}/files/${fileId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permittedDepartments }),
    }),

  downloadUrl: (kbId: string, fileId: string) =>
    `${BASE}/knowledge-bases/${kbId}/files/${fileId}/file`,
};

// ─── Knowledge Documents ──────────────────────────────────────────────────────

export const knowledgeDocumentsApi = {
  list: (params?: {
    knowledgeBaseId?: string;
    status?: DocStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.knowledgeBaseId) q.set('knowledgeBaseId', params.knowledgeBaseId);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    q.set('pageSize', String(params?.pageSize ?? 100));
    return req<PagedResult<KnowledgeDocument>>(`/knowledge-documents?${q}`);
  },

  get: (id: string) =>
    req<KnowledgeDocument>(`/knowledge-documents/${id}`),

  versions: (id: string) =>
    req<{ items: DocumentVersion[] }>(`/knowledge-documents/${id}/versions`),

  approve: (id: string) =>
    req<KnowledgeDocument>(`/knowledge-documents/${id}/approve`, { method: 'POST' }),

  returnDraft: (id: string) =>
    req<KnowledgeDocument>(`/knowledge-documents/${id}/return-draft`, { method: 'POST' }),

  requestRevision: (id: string, revisionNote: string) =>
    req<KnowledgeDocument>(`/knowledge-documents/${id}/request-revision`, {
      method: 'POST',
      body: JSON.stringify({ revisionNote }),
    }),

  rollback: (id: string) =>
    req<KnowledgeDocument>(`/knowledge-documents/${id}/rollback`, { method: 'POST' }),

  archive: (id: string) =>
    req<KnowledgeDocument>(`/knowledge-documents/${id}/archive`, { method: 'POST' }),
};
