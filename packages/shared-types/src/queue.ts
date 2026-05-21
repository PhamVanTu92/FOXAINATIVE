export const QUEUE_NAMES = {
  OCR: 'ocr-queue',
  EMBEDDING: 'embedding-queue',
  EXPORT: 'export-queue',
  KB_SYNC: 'kb-sync-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface OcrJobPayload {
  documentId: string;
  schemaId: string;
  fileUrl: string;
  mimeType?: string;
  language: 'vi' | 'en' | 'vi+en';
}

export interface EmbeddingJobPayload {
  documentId: string;
  knowledgeId?: string;
}

export interface ExportJobPayload {
  documentIds: string[];
  requestedBy: string;
  format: 'xlsx';
}

export interface KbSyncJobPayload {
  knowledgeId: string;
}
