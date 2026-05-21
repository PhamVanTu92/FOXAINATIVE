export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  errors?: Array<{ field: string; constraint: string }>;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UploadAcceptedResponse {
  documentId: string;
  jobId: string;
  status: 'QUEUED';
  message: string;
}
