import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface DepartmentRef {
  departmentId: string;
  departmentName: string;
}

export interface FileCounts {
  word: number;
  excel: number;
  pdf: number;
  image: number;
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export interface KnowledgeBaseMessage {
  id: string;
  code: string;
  name: string;
  description: string;
  managingDepartmentId: string;
  managingDepartmentName: string;
  permissions: DepartmentRef[];
  fileCounts: FileCounts;
  totalFiles: number;
  createdAt: string;
  updatedAt: string;
  /** UUID của collection trong index-service. Rỗng ("") nếu chưa được map. */
  collectionId: string;
}

export interface KnowledgeFileMessage {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  fileName: string;
  fileType: string;
  fileSizeMb: number;
  storagePath: string;
  uploadedAt: string;
  updatedAt: string;
  permissions: DepartmentRef[];
  /** UUID tài liệu trong index-service. Rỗng ("") nếu chưa được index. */
  documentIndexId: string;
}

export interface AllFileCountsMessage {
  word: number;
  excel: number;
  pdf: number;
  image: number;
  powerPoint: number;
  text: number;
  total: number;
}

export interface ListAllKnowledgeFilesRequest {
  search?: string;
  fileType?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAllKnowledgeFilesResponse {
  items: KnowledgeFileMessage[];
  total: number;
  page: number;
  pageSize: number;
  counts: AllFileCountsMessage;
}

export interface StatsMessage {
  totalKnowledgeBases: number;
  totalFiles: number;
  departmentsUsingCount: number;
  lastUpdatedAt: string;
}

export interface DeleteResponse {
  success: boolean;
}

// ─── Request types ───────────────────────────────────────────────────────────

export interface ListKnowledgeBasesRequest {
  search?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListKnowledgeBasesResponse {
  items: KnowledgeBaseMessage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetKnowledgeBaseRequest { id: string; }

export interface CreateKnowledgeBaseRequest {
  code: string;
  name: string;
  description?: string;
  managingDepartmentId: string;
  managingDepartmentName: string;
  permittedDepartments: DepartmentRef[];
  createdBy?: string;
}

export interface UpdateKnowledgeBaseRequest {
  id: string;
  name: string;
  description?: string;
  managingDepartmentId: string;
  managingDepartmentName: string;
  permittedDepartments: DepartmentRef[];
}

export interface DeleteKnowledgeBaseRequest { id: string; }

export interface GetStatsRequest {}

export interface ListKnowledgeFilesRequest {
  knowledgeBaseId: string;
  search?: string;
  fileType?: string;
  page?: number;
  pageSize?: number;
}

export interface ListKnowledgeFilesResponse {
  items: KnowledgeFileMessage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetKnowledgeFileRequest { id: string; knowledgeBaseId: string; }

export interface MoveKnowledgeFileRequest {
  id: string;
  fileName?: string;
  targetKnowledgeBaseId?: string;
}

export interface AddKnowledgeFileRequest {
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSizeMb: number;
  permittedDepartments: DepartmentRef[];
  uploadedBy?: string;
  storagePath?: string;
}

export interface UpdateKnowledgeFileRequest {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSizeMb: number;
}

export interface DeleteKnowledgeFileRequest {
  id: string;
  knowledgeBaseId: string;
}

export interface UpdateFilePermissionsRequest {
  id: string;
  knowledgeBaseId: string;
  permittedDepartments: DepartmentRef[];
}

// ─── Knowledge Document message types ────────────────────────────────────────

export interface KnowledgeDocumentMessage {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  title: string;
  fileType: string;
  fileSizeMb: number;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: string;
  status: string;
  currentVersion: string;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentVersionMessage {
  id: string;
  documentId: string;
  versionNumber: string;
  changeNote: string;
  contentSummary: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

export interface UploadDocumentRequest {
  knowledgeBaseId: string;
  title: string;
  fileType: string;
  fileSizeMb?: number;
  contentSummary?: string;
  note?: string;
  uploadedBy?: string;
  storagePath?: string;
}

export interface GetDocumentRequest { id: string; }

export interface ListDocumentsRequest {
  knowledgeBaseId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ListDocumentsResponse {
  items: KnowledgeDocumentMessage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentActionRequest { id: string; }

export interface RequestDocumentRevisionRequest {
  id: string;
  revisionNote: string;
}

export interface CreateDocumentVersionRequest {
  id: string;
  changeNote: string;
  contentSummary?: string;
  createdBy?: string;
}

export interface ListDocumentVersionsRequest { documentId: string; }

export interface ListDocumentVersionsResponse {
  items: KnowledgeDocumentVersionMessage[];
}

// ─── gRPC Service interface ──────────────────────────────────────────────────

export interface KnowledgeGrpcService {
  listKnowledgeBases(req: ListKnowledgeBasesRequest, md?: Metadata): Observable<ListKnowledgeBasesResponse>;
  getKnowledgeBase(req: GetKnowledgeBaseRequest, md?: Metadata): Observable<KnowledgeBaseMessage>;
  createKnowledgeBase(req: CreateKnowledgeBaseRequest, md?: Metadata): Observable<KnowledgeBaseMessage>;
  updateKnowledgeBase(req: UpdateKnowledgeBaseRequest, md?: Metadata): Observable<KnowledgeBaseMessage>;
  deleteKnowledgeBase(req: DeleteKnowledgeBaseRequest, md?: Metadata): Observable<DeleteResponse>;
  getStats(req: GetStatsRequest, md?: Metadata): Observable<StatsMessage>;
  listAllKnowledgeFiles(req: ListAllKnowledgeFilesRequest, md?: Metadata): Observable<ListAllKnowledgeFilesResponse>;
  listKnowledgeFiles(req: ListKnowledgeFilesRequest, md?: Metadata): Observable<ListKnowledgeFilesResponse>;
  getKnowledgeFile(req: GetKnowledgeFileRequest, md?: Metadata): Observable<KnowledgeFileMessage>;
  addKnowledgeFile(req: AddKnowledgeFileRequest, md?: Metadata): Observable<KnowledgeFileMessage>;
  updateKnowledgeFile(req: UpdateKnowledgeFileRequest, md?: Metadata): Observable<KnowledgeFileMessage>;
  deleteKnowledgeFile(req: DeleteKnowledgeFileRequest, md?: Metadata): Observable<DeleteResponse>;
  updateFilePermissions(req: UpdateFilePermissionsRequest, md?: Metadata): Observable<KnowledgeFileMessage>;
  moveKnowledgeFile(req: MoveKnowledgeFileRequest, md?: Metadata): Observable<KnowledgeFileMessage>;
  // Knowledge Documents
  uploadDocument(req: UploadDocumentRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  getDocument(req: GetDocumentRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  listDocuments(req: ListDocumentsRequest, md?: Metadata): Observable<ListDocumentsResponse>;
  submitDocumentForReview(req: DocumentActionRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  approveDocument(req: DocumentActionRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  returnDocumentToDraft(req: DocumentActionRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  requestDocumentRevision(req: RequestDocumentRevisionRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  archiveDocument(req: DocumentActionRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  rollbackDocument(req: DocumentActionRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  createDocumentVersion(req: CreateDocumentVersionRequest, md?: Metadata): Observable<KnowledgeDocumentMessage>;
  listDocumentVersions(req: ListDocumentVersionsRequest, md?: Metadata): Observable<ListDocumentVersionsResponse>;
}
