import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { KNOWLEDGE_PACKAGE } from '../grpc/knowledge-grpc.module';
import { callGrpc } from '../common/grpc/grpc-error-mapper';
import {
  AddKnowledgeFileRequest,
  GetKnowledgeFileRequest,
  CreateDocumentVersionRequest,
  CreateKnowledgeBaseRequest,
  DeleteKnowledgeBaseRequest,
  DeleteKnowledgeFileRequest,
  DeleteResponse,
  DocumentActionRequest,
  GetDocumentRequest,
  GetKnowledgeBaseRequest,
  GetStatsRequest,
  KnowledgeBaseMessage,
  KnowledgeDocumentMessage,
  KnowledgeDocumentVersionMessage,
  KnowledgeFileMessage,
  KnowledgeGrpcService,
  ListDocumentsRequest,
  ListDocumentsResponse,
  ListDocumentVersionsRequest,
  ListDocumentVersionsResponse,
  ListKnowledgeBasesRequest,
  ListKnowledgeBasesResponse,
  ListKnowledgeFilesRequest,
  ListKnowledgeFilesResponse,
  RequestDocumentRevisionRequest,
  StatsMessage,
  UpdateFilePermissionsRequest,
  UpdateKnowledgeBaseRequest,
  UpdateKnowledgeFileRequest,
  UploadDocumentRequest,
} from './knowledge-grpc-interfaces';

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private grpc!: KnowledgeGrpcService;

  constructor(@Inject(KNOWLEDGE_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.grpc = this.client.getService<KnowledgeGrpcService>('KnowledgeService');
  }

  // ─── Knowledge Bases ───────────────────────────────────────────────────────

  listKnowledgeBases(req: ListKnowledgeBasesRequest, md?: Metadata): Promise<ListKnowledgeBasesResponse> {
    return callGrpc(this.grpc.listKnowledgeBases(req, md));
  }

  getKnowledgeBase(req: GetKnowledgeBaseRequest, md?: Metadata): Promise<KnowledgeBaseMessage> {
    return callGrpc(this.grpc.getKnowledgeBase(req, md));
  }

  createKnowledgeBase(req: CreateKnowledgeBaseRequest, md?: Metadata): Promise<KnowledgeBaseMessage> {
    return callGrpc(this.grpc.createKnowledgeBase(req, md));
  }

  updateKnowledgeBase(req: UpdateKnowledgeBaseRequest, md?: Metadata): Promise<KnowledgeBaseMessage> {
    return callGrpc(this.grpc.updateKnowledgeBase(req, md));
  }

  deleteKnowledgeBase(req: DeleteKnowledgeBaseRequest, md?: Metadata): Promise<DeleteResponse> {
    return callGrpc(this.grpc.deleteKnowledgeBase(req, md));
  }

  getStats(req: GetStatsRequest, md?: Metadata): Promise<StatsMessage> {
    return callGrpc(this.grpc.getStats(req, md));
  }

  // ─── Knowledge Files ───────────────────────────────────────────────────────

  listKnowledgeFiles(req: ListKnowledgeFilesRequest, md?: Metadata): Promise<ListKnowledgeFilesResponse> {
    return callGrpc(this.grpc.listKnowledgeFiles(req, md));
  }

  getKnowledgeFile(req: GetKnowledgeFileRequest, md?: Metadata): Promise<KnowledgeFileMessage> {
    return callGrpc(this.grpc.getKnowledgeFile(req, md));
  }

  addKnowledgeFile(req: AddKnowledgeFileRequest, md?: Metadata): Promise<KnowledgeFileMessage> {
    return callGrpc(this.grpc.addKnowledgeFile(req, md));
  }

  updateKnowledgeFile(req: UpdateKnowledgeFileRequest, md?: Metadata): Promise<KnowledgeFileMessage> {
    return callGrpc(this.grpc.updateKnowledgeFile(req, md));
  }

  deleteKnowledgeFile(req: DeleteKnowledgeFileRequest, md?: Metadata): Promise<DeleteResponse> {
    return callGrpc(this.grpc.deleteKnowledgeFile(req, md));
  }

  updateFilePermissions(req: UpdateFilePermissionsRequest, md?: Metadata): Promise<KnowledgeFileMessage> {
    return callGrpc(this.grpc.updateFilePermissions(req, md));
  }

  // ─── Knowledge Documents ───────────────────────────────────────────────────

  uploadDocument(req: UploadDocumentRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.uploadDocument(req, md));
  }

  getDocument(req: GetDocumentRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.getDocument(req, md));
  }

  listDocuments(req: ListDocumentsRequest, md?: Metadata): Promise<ListDocumentsResponse> {
    return callGrpc(this.grpc.listDocuments(req, md));
  }

  submitDocumentForReview(req: DocumentActionRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.submitDocumentForReview(req, md));
  }

  approveDocument(req: DocumentActionRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.approveDocument(req, md));
  }

  returnDocumentToDraft(req: DocumentActionRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.returnDocumentToDraft(req, md));
  }

  requestDocumentRevision(req: RequestDocumentRevisionRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.requestDocumentRevision(req, md));
  }

  archiveDocument(req: DocumentActionRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.archiveDocument(req, md));
  }

  rollbackDocument(req: DocumentActionRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.rollbackDocument(req, md));
  }

  createDocumentVersion(req: CreateDocumentVersionRequest, md?: Metadata): Promise<KnowledgeDocumentMessage> {
    return callGrpc(this.grpc.createDocumentVersion(req, md));
  }

  listDocumentVersions(req: ListDocumentVersionsRequest, md?: Metadata): Promise<ListDocumentVersionsResponse> {
    return callGrpc(this.grpc.listDocumentVersions(req, md));
  }
}
