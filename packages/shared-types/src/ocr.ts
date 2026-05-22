export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface OcrExtractedField {
  fieldKey: string;
  value: string;
  confidence: number;
  bbox?: BoundingBox;
}

export interface OcrExtractedLineItem {
  stt: number;
  name?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  extraData?: Record<string, unknown>;
}

export interface OcrResult {
  confidence: number;
  language: string;
  engineVersion: string;
  fields: OcrExtractedField[];
  lineItems: OcrExtractedLineItem[];
  error?: string;
}

export interface OcrSchemaField {
  fieldKey: string;
  label: string;
  dataType: string;
  description?: string | null;
}

export interface OcrRequest {
  documentId: string;
  schemaId: string;
  fileUrl: string;
  mimeType?: string;
  language: 'vi' | 'en' | 'vi+en';
  schemaFields?: OcrSchemaField[];
}
