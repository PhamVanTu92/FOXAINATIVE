const BASE = process.env.NEXT_PUBLIC_OCR_API_URL ?? 'http://localhost:3003';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? `HTTP ${res.status}`);
  return json as T;
}

export type DocStatus = 'DRAFT' | 'PROCESSED' | 'CONFIRMED' | 'TRANSFERRED' | 'ERROR';
export type DocType = 'INVOICE' | 'RECEIPT' | 'CONTRACT' | 'STATEMENT' | 'MINUTES' | 'WAREHOUSE_RECEIPT' | 'OTHERS';
export type DataType = 'TEXT' | 'DATE' | 'NUMBER' | 'CURRENCY' | 'BOOLEAN' | 'LIST';
export type FieldPosition = 'HEADER' | 'FOOTER' | 'BODY';

export interface DocStats {
  total: number;
  draft: number;
  confirmed: number;
  processed: number;
  transferred: number;
  error: number;
}

export interface DocListItem {
  id: string;
  fileName: string | null;
  status: DocStatus;
  invoiceNumber: string | null;
  issueDate: string | null;
  sellerName: string | null;
  sellerTaxCode: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  grandTotal: number | null;
  ocrConfidence: number | null;
  ocrError: string | null;
  createdAt: string;
  schemaCode: string;
  schema: { name: string; type: DocType };
}

export interface DocListResponse {
  items: DocListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SchemaField {
  id: string;
  fieldKey: string;
  label: string;
  dataType: DataType;
  position: FieldPosition;
  isRequired: boolean;
  description: string | null;
  displayOrder: number;
}

export interface SchemaTableColumn {
  id: string;
  columnKey: string;
  label: string;
  dataType: DataType;
  isRequired: boolean;
  displayOrder: number;
  description: string | null;
}

export interface SchemaTable {
  id: string;
  tableKey: string;
  name: string;
  columns: SchemaTableColumn[];
}

export interface SchemaDetail {
  id: string;
  code: string;
  name: string;
  type: DocType;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  fields: SchemaField[];
  tables: SchemaTable[];
}

export interface DocValue {
  fieldId: string;
  field: SchemaField;
  stringValue: string | null;
  confidence: number | null;
  isManuallyEdited: boolean;
  pageNumber: number | null;
}

export interface LineItem {
  id: string;
  stt: number;
  tableKey?: string | null;
  name: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  extraData?: Record<string, unknown> | null;
  isManuallyAdded: boolean;
}

export type OcrJobState = 'waiting' | 'active' | 'delayed' | 'completed' | 'failed' | 'not_found';

export interface JobStatus {
  state: OcrJobState;
  progress?: number;
  failedReason?: string;
}

export type SseEvent =
  | { type: 'progress'; state: OcrJobState; progress: number }
  | { type: 'done'; document: DocDetail }
  | { type: 'failed'; error: string };

export interface AuditLog {
  id: string;
  action: string;
  changedBy: string;
  changedAt: string;
  note: string | null;
  oldStatus: DocStatus | null;
  newStatus: DocStatus | null;
}

export interface DocDetail extends DocListItem {
  mimeType: string | null;
  fileUrl: string | null;
  schema: SchemaDetail;
  values: DocValue[];
  lineItems: LineItem[];
  auditLogs: AuditLog[];
}

export interface SchemaListItem {
  id: string;
  code: string;
  name: string;
  type: DocType;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  _count: { fields: number; tables: number; documents: number };
}

export interface SchemaStats {
  totalSchemas: number;
  activeSchemas: number;
  totalFields: number;
  totalTables: number;
}

function buildQs(params: Record<string, string | string[]>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(s => sp.append(k, s));
    else if (v) sp.append(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const ocrApi = {
  // Documents
  getDocumentFileUrl: (id: string) => `${BASE}/documents/${id}/file`,
  getDocumentSseUrl:  (id: string) => `${BASE}/documents/${id}/sse`,
  getJobStatus: (id: string) => req<JobStatus>(`/documents/${id}/job-status`),

  getStats: () => req<DocStats>('/documents/stats'),

  getDocuments: (params: Record<string, string | string[]> = {}) =>
    req<DocListResponse>(`/documents${buildQs(params)}`),

  getDocument: (id: string) => req<DocDetail>(`/documents/${id}`),

  uploadDocument: (file: File, schemaId: string, language = 'vi') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('schemaId', schemaId);
    fd.append('language', language);
    return req<{ documentId: string; jobId: string; status: string; message: string }>(
      '/documents/upload',
      { method: 'POST', body: fd },
    );
  },

  updateDocument: (
    id: string,
    body: {
      values?: Array<{ fieldId: string; stringValue: string }>;
      lineItems?: Array<{ stt: number; tableKey?: string | null; name?: string | null; unit?: string | null; quantity?: number | null; unitPrice?: number | null; amount?: number | null; extraData?: Record<string, unknown> | null }>;
    },
  ) => req<DocDetail>(`/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  confirmDocument: (id: string, note?: string) =>
    req<DocDetail>(`/documents/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    }),

  deleteDocument: (id: string) =>
    req<{ deleted: boolean }>(`/documents/${id}`, { method: 'DELETE' }),

  bulkConfirm: (documentIds: string[]) =>
    req<{ confirmed: number; skipped: string[] }>('/documents/bulk-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds }),
    }),

  bulkTransfer: (documentIds: string[]) =>
    req<{ transferred: number; skipped: string[] }>('/documents/bulk-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds }),
    }),

  bulkDelete: (documentIds: string[]) =>
    req<{ deleted: number; skipped: string[] }>('/documents/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds }),
    }),

  // Schemas
  getSchemaStats: () => req<SchemaStats>('/schemas/stats'),

  getSchemas: (params: Record<string, string> = {}) =>
    req<SchemaListItem[]>(`/schemas${buildQs(params)}`),

  getSchema: (id: string) => req<SchemaDetail>(`/schemas/${id}`),

  getSchemaByCode: (code: string) => req<SchemaDetail>(`/schemas/code/${code}`),

  createSchema: (body: {
    code: string;
    name: string;
    type: DocType;
    description?: string;
    fields: Array<{
      fieldKey: string;
      label: string;
      dataType: DataType;
      position: FieldPosition;
      isRequired?: boolean;
      description?: string;
    }>;
    tables?: Array<{
      tableKey: string;
      name: string;
      columns: Array<{ columnKey: string; label: string; dataType: DataType }>;
    }>;
  }) => req<SchemaDetail>('/schemas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  updateSchema: (id: string, body: Partial<{ name: string; description: string; isActive: boolean; type: DocType }>) =>
    req<SchemaDetail>(`/schemas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  deleteSchema: (id: string) =>
    req<{ deleted: boolean }>(`/schemas/${id}`, { method: 'DELETE' }),

  addField: (schemaId: string, body: {
    fieldKey: string;
    label: string;
    dataType: DataType;
    position: FieldPosition;
    isRequired?: boolean;
    description?: string;
  }) => req<SchemaField>(`/schemas/${schemaId}/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  removeField: (schemaId: string, fieldId: string) =>
    req<{ deleted: boolean }>(`/schemas/${schemaId}/fields/${fieldId}`, { method: 'DELETE' }),

  updateField: (schemaId: string, fieldId: string, body: Partial<{
    label: string; dataType: DataType; position: FieldPosition; isRequired: boolean; description: string;
  }>) => req<SchemaField>(`/schemas/${schemaId}/fields/${fieldId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  addTable: (schemaId: string, body: {
    tableKey: string; name: string; description?: string;
    columns: Array<{ columnKey: string; label: string; dataType: DataType; isRequired?: boolean }>;
  }) => req<SchemaTable>(`/schemas/${schemaId}/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  removeTable: (schemaId: string, tableId: string) =>
    req<{ deleted: boolean }>(`/schemas/${schemaId}/tables/${tableId}`, { method: 'DELETE' }),

  addTableColumn: (schemaId: string, tableId: string, body: {
    columnKey: string; label: string; dataType: DataType; isRequired?: boolean; description?: string;
  }) => req<SchemaTableColumn>(`/schemas/${schemaId}/tables/${tableId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  removeTableColumn: (schemaId: string, tableId: string, columnId: string) =>
    req<{ deleted: boolean }>(`/schemas/${schemaId}/tables/${tableId}/columns/${columnId}`, { method: 'DELETE' }),

  updateTable: (schemaId: string, tableId: string, body: Partial<{ name: string; description: string }>) =>
    req<SchemaTable>(`/schemas/${schemaId}/tables/${tableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  updateTableColumn: (schemaId: string, tableId: string, columnId: string, body: Partial<{ label: string; dataType: DataType; description: string }>) =>
    req<SchemaTableColumn>(`/schemas/${schemaId}/tables/${tableId}/columns/${columnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};
