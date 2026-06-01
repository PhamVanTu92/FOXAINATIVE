const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api`;

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseError(json: unknown, status: number): string {
  const j = json as { message?: string; error?: string };
  return j.message ?? j.error ?? `HTTP ${status}`;
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
  if (!res.ok) throw new Error(parseError(json, res.status));
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
  knowledgeBaseName?: string;
  fileName: string;
  fileType: string;
  fileSizeMb: number;
  storagePath: string;
  uploadedAt: string;
  updatedAt: string;
  permissions: DepartmentRef[];
}

export interface AllFileCounts {
  word: number;
  excel: number;
  pdf: number;
  image: number;
  powerPoint: number;
  text: number;
  total: number;
}

export interface KbAllFilesResult {
  items: KnowledgeFile[];
  total: number;
  page: number;
  pageSize: number;
  counts: AllFileCounts;
}

export type DocStatus = 'Draft' | 'Review' | 'Approved' | 'Archived';
export type FileType = 'Word' | 'Excel' | 'PDF' | 'Image' | 'PowerPoint' | 'Text';

export interface KnowledgeDocument {
  id: string;
  title: string;
  status: DocStatus;
  fileType: FileType;
  fileSizeMb?: number;
  storagePath?: string;
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
  documentId: string;
  versionNumber: string;
  changeNote: string;
  contentSummary: string;
  status: DocStatus;
  createdBy: string;
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

  allFiles: (params?: { search?: string; fileType?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.fileType) q.set('fileType', params.fileType);
    if (params?.page) q.set('page', String(params.page));
    q.set('pageSize', String(params?.pageSize ?? 50));
    return req<KbAllFilesResult>(`/knowledge-bases/files?${q}`);
  },
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

  add: async (kbId: string, payload: {
    file: File;
    fileName?: string;
    fileType?: string;
    permittedDepartments?: DepartmentRef[];
  }): Promise<KnowledgeFile> => {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.fileName) form.append('fileName', payload.fileName);
    if (payload.fileType) form.append('fileType', payload.fileType);
    if (payload.permittedDepartments?.length) {
      form.append('permittedDepartments', JSON.stringify(payload.permittedDepartments));
    }
    const res = await fetch(`${BASE}/knowledge-bases/${kbId}/files`, {
      method: 'POST',
      headers: authHeader(),
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseError(json, res.status));
    return json as KnowledgeFile;
  },

  update: (fileId: string, body: { fileName?: string; targetKnowledgeBaseId?: string }) =>
    req<KnowledgeFile>(`/knowledge-bases/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /** Gỡ tệp khỏi bộ tri thức (không xóa hẳn — đặt knowledgeBaseId = null) */
  unlink: (fileId: string) =>
    req<KnowledgeFile>(`/knowledge-bases/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ targetKnowledgeBaseId: null }),
    }),

  remove: (kbId: string, fileId: string) =>
    req<void>(`/knowledge-bases/${kbId}/files/${fileId}`, { method: 'DELETE' }),

  updatePermissions: (kbId: string, fileId: string, permittedDepartments: DepartmentRef[]) =>
    req<KnowledgeFile>(`/knowledge-bases/${kbId}/files/${fileId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permittedDepartments }),
    }),

  downloadUrl: (kbId: string, fileId: string) =>
    `${BASE}/knowledge-bases/${kbId}/files/${fileId}/file`,

  fetchBlob: async (kbId: string, fileId: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/knowledge-bases/${kbId}/files/${fileId}/file`, {
      headers: authHeader(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  },
};

// ─── Knowledge Files Standalone (POST /api/knowledge-files) ──────────────────

async function _postKnowledgeFile(form: FormData): Promise<KnowledgeFile> {
  const res = await fetch(`${BASE}/knowledge-files`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(json, res.status));
  return json as KnowledgeFile;
}

export const knowledgeFilesStandaloneApi = {
  upload: async (payload: {
    file: File;
    knowledgeBaseId?: string;
    fileName?: string;
    fileType?: string;
    permittedDepartments?: DepartmentRef[];
  }): Promise<KnowledgeFile> => {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.knowledgeBaseId) form.append('knowledgeBaseId', payload.knowledgeBaseId);
    if (payload.fileName) form.append('fileName', payload.fileName);
    if (payload.fileType) form.append('fileType', payload.fileType);
    if (payload.permittedDepartments?.length) {
      form.append('permittedDepartments', JSON.stringify(payload.permittedDepartments));
    }
    return _postKnowledgeFile(form);
  },

  /** Xóa vĩnh viễn tệp khỏi hệ thống (chỉ dùng từ Tổng tri thức) */
  remove: (fileId: string) =>
    req<void>(`/knowledge-files/${fileId}`, { method: 'DELETE' }),

  /** Fetch file từ URL (có auth) rồi upload lên /api/knowledge-files */
  uploadFromUrl: async (payload: {
    fileUrl: string;
    knowledgeBaseId?: string;
    fileName?: string;
    fileType?: string;
  }): Promise<KnowledgeFile> => {
    const fileRes = await fetch(payload.fileUrl, { headers: authHeader() });
    if (!fileRes.ok) throw new Error(`Không thể tải file: HTTP ${fileRes.status}`);
    const blob = await fileRes.blob();
    const file = new File([blob], payload.fileName ?? 'document', { type: blob.type });
    const form = new FormData();
    form.append('file', file);
    if (payload.knowledgeBaseId) form.append('knowledgeBaseId', payload.knowledgeBaseId);
    if (payload.fileName) form.append('fileName', payload.fileName);
    if (payload.fileType) form.append('fileType', payload.fileType);
    return _postKnowledgeFile(form);
  },
};

// ─── Knowledge Documents ──────────────────────────────────────────────────────

export const knowledgeDocumentsApi = {
  create: async (payload: {
    knowledgeBaseId?: string;
    title: string;
    file?: File;
    fileType?: string;
    contentSummary?: string;
    note?: string;
  }): Promise<KnowledgeDocument> => {
    const form = new FormData();
    if (payload.knowledgeBaseId) form.append('knowledgeBaseId', payload.knowledgeBaseId);
    form.append('title', payload.title);
    if (payload.file) form.append('file', payload.file);
    if (payload.fileType) form.append('fileType', payload.fileType);
    if (payload.contentSummary) form.append('contentSummary', payload.contentSummary);
    if (payload.note) form.append('note', payload.note);
    const res = await fetch(`${BASE}/knowledge-documents`, {
      method: 'POST',
      headers: authHeader(),
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseError(json, res.status));
    return json as KnowledgeDocument;
  },

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

  submitReview: (id: string) =>
    req<KnowledgeDocument>(`/knowledge-documents/${id}/submit-review`, { method: 'POST' }),

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

  fileUrl: (id: string) =>
    `${BASE}/knowledge-documents/${id}/file`,
};
