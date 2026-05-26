export const QUEUE_NAMES = {
  OCR: 'ocr-queue',
  EMBEDDING: 'embedding-queue',
  EXPORT: 'export-queue',
  KB_SYNC: 'kb-sync-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type OcrProviderName = 'gemini' | 'claude' | 'local-pdf' | 'mock';

export interface OcrFileRef {
  url: string;
  mimeType?: string;
}

export interface OcrJobPayload {
  documentId: string;
  schemaId: string;
  fileUrl: string;
  mimeType?: string;
  extraFileUrls?: OcrFileRef[];
  language: 'vi' | 'en' | 'vi+en';
  ocrProvider?: OcrProviderName;
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
