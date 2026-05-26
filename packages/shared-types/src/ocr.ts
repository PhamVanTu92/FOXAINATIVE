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
  tableKey?: string;
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

export interface OcrSchemaTableColumn {
  columnKey: string;
  label: string;
  dataType: string;
}

export interface OcrSchemaTable {
  tableKey: string;
  name: string;
  columns: OcrSchemaTableColumn[];
}

export interface OcrRequest {
  documentId: string;
  schemaId: string;
  fileUrl: string;
  mimeType?: string;
  language: 'vi' | 'en' | 'vi+en';
  schemaFields?: OcrSchemaField[];
  /** Định nghĩa các bảng tùy chỉnh — AI dùng để điền extraData thay vì name/unit/qty/price/amount */
  schemaTables?: OcrSchemaTable[];
  /** Prompt chung do người dùng cấu hình cho loại chứng từ này */
  promptTemplate?: string | null;
}
