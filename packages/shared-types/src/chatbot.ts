export interface ChatRequest {
  sessionId?: string;
  message: string;
  knowledgeBaseIds?: string[];
}

export interface ChatResponse {
  sessionId: string;
  answer: string;
  sources: Array<{
    knowledgeId: string;
    title: string;
    excerpt: string;
    score: number;
  }>;
}

export interface KnowledgeDocumentDto {
  id: string;
  title: string;
  content: string;
  tags: string[];
  embeddingStatus: 'PENDING' | 'DONE' | 'ERROR';
  createdAt: string;
}
