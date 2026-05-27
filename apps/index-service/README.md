# Index Service

Document indexing and processing service for Robot Reception system. Handles document upload, parsing, chunking, embedding generation, and storage in vector databases.

## Overview

The Index service manages the entire document processing pipeline from upload to vectorization. It processes various document formats (PDF, DOCX, XLSX, images), generates embeddings, and stores them in Qdrant for efficient similarity search.

## Architecture

Clean Architecture with clear layer separation:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Routers)                       │
│  • Collection management endpoints                           │
│  • Document upload/processing endpoints                      │
│  • Input validation (router level)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   App Layer (Services)                       │
│  • Document upload orchestration                             │
│  • Batch processing coordination                             │
│  • Collection lifecycle management                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Domain Layer (Services)                      │
│  • Document parsing (PDF, DOCX, XLSX)                        │
│  • Text chunking strategies                                  │
│  • Embedding generation                                      │
│  • Vector storage operations                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│            Infrastructure Layer                              │
│  • MinIO: Object storage for uploaded files                  │
│  • Qdrant: Vector database for embeddings                    │
│  • PostgreSQL: Metadata storage                              │
│  • Redis: Caching layer                                      │
│  • LLM Providers: OpenAI, Claude, Gemini, FoxAI             │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Document Processing
- ✅ **Multi-format Support**: PDF, DOCX, XLSX, images (PNG, JPG, JPEG)
- ✅ **Batch Upload**: Upload multiple documents simultaneously
- ✅ **Batch Processing**: Process documents with shared metadata
- ✅ **Vision LLM**: OCR for scanned PDFs and images using Gemini/OpenAI Vision
- ✅ **Smart Chunking**: Sentence-based, page-based, and structured chunking strategies

### Collection Management
- ✅ **Create Collections**: Organize documents into logical collections
- ✅ **List Collections**: Paginated collection listing with search
- ✅ **Delete Collections**: Remove collections and associated documents
- ✅ **Multi-provider**: Support for Qdrant and Milvus vector databases

### Embedding Generation
- ✅ **Multi-provider Support**: OpenAI, Claude, Gemini, FoxAI LLM, Azure OpenAI
- ✅ **Dimension Flexibility**: Configurable embedding dimensions
- ✅ **Batch Processing**: Efficient batch embedding generation
- ✅ **Caching**: Redis caching for improved performance

### Access Control
- ✅ **Role-Based Access**: Admin and Manager roles required for all operations
- ✅ **Organization Isolation**: Multi-tenant support with org_id
- ✅ **JWT Authentication**: Keycloak integration for secure access

## API Endpoints

### Authentication
All endpoints require **admin** or **manager** role.

**Headers:**
```
Authorization: Bearer <access_token>
```

### Collection Endpoints

#### POST `/{org_id}/collections`
Create new collection.

**Request Body:**
```json
{
  "collection_name": "my_collection",
  "description": "Collection description",
  "provider_storage": "qdrant",
  "provider_embedding": "foxaillm"
}
```

**Response (201):**
```json
{
  "message": "Collection 'my_collection' created successfully",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "collection_name": "my_collection",
  "org_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

#### GET `/{org_id}/collections`
List collections with pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 10, max: 100)
- `search`: Search term for filtering

**Response (200):**
```json
{
  "message": "Collections retrieved successfully",
  "data": {
    "collections": [...],
    "total": 25,
    "page": 1,
    "page_size": 10,
    "total_pages": 3
  }
}
```

#### DELETE `/{org_id}/collections/{collection_id}`
Delete collection and all documents.

**Response (200):**
```json
{
  "message": "Collection deleted successfully",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Document Endpoints

#### POST `/collections/{collection_id}/documents/batch-upload`
Upload multiple documents (Step 1 of 2).

**Form Data:**
- `files`: Multiple files (max 10)

**Response (201):**
```json
{
  "message": "Batch upload completed: 5 files uploaded successfully",
  "documents": [
    {
      "document_id": "123e4567-e89b-12d3-a456-426614174000",
      "file_name": "document1.pdf",
      "file_url": "https://minio.example.com/files/...",
      "file_size": 1024000,
      "status": "pending"
    }
  ],
  "successful_count": 5,
  "failed_count": 0,
  "total_count": 5
}
```

#### POST `/collections/{collection_id}/documents/batch-process`
Process uploaded documents with metadata (Step 2 of 2).

**Request Body:**
```json
{
  "document_ids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-12d3-a456-426614174001"
  ],
  "processing_type": "sentence_based",
  "effective_from": "2024-01-01T00:00:00Z",
  "effective_to": "2025-12-31T23:59:59Z",
  "issuing_unit": "IT Department",
  "access_scope": "internal",
  "version": "1.0"
}
```

**Response (202):**
```json
{
  "message": "Batch processing started for 2 documents",
  "task_id": "task-123456",
  "status": "processing"
}
```

#### GET `/collections/{collection_id}/documents`
List documents with pagination and filters.

**Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 10, max: 100)
- `search`: Search term
- `processing_status`: Filter by status (pending, processing, completed, failed)
- `processing_type`: Filter by type (excel, sentence_based, etc.)

**Response (200):**
```json
{
  "message": "Documents retrieved successfully",
  "data": {
    "documents": [...],
    "total": 50,
    "page": 1,
    "page_size": 10,
    "total_pages": 5
  }
}
```

#### GET `/documents/{document_id}`
Get document by ID.

**Response (200):**
```json
{
  "message": "Document retrieved successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "document_name": "example.pdf",
    "collection_name": "my_collection",
    "file_size": 1024000,
    "processing_status": "completed",
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

#### DELETE `/documents/{document_id}`
Delete document from collection and vector store.

**Response (200):**
```json
{
  "message": "Document deleted successfully",
  "document_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Public Endpoints (No Authentication)

#### GET `/documents/{document_id}/file`
Download original file.

#### GET `/documents/{document_id}/image`
Get document thumbnail/preview image.

## Configuration

### Environment Variables

```bash
# === LLM Providers ===
OPENAI__API_KEY=sk-...
OPENAI__EMBEDDING_MODEL=text-embedding-3-small
GEMINI__API_KEY=...
CLAUDE__API_KEY=...
FOXAILLM__API_KEY=...
FOXAILLM__BASE_URL=https://api.foxai.vn

# === Storage ===
QDRANT__HOST=http://localhost:6333
QDRANT__API_KEY=...
QDRANT__COLLECTION_NAME=default-collection

MINIO__HOST=localhost:9000
MINIO__USERNAME=minioadmin
MINIO__PASSWORD=minioadmin
MINIO__BUCKET_NAME=documents
MINIO__PUBLIC_URL_BASE=http://localhost:5401

# === Database ===
POSTGRES__HOST=localhost
POSTGRES__PORT=5432
POSTGRES__USERNAME=postgres
POSTGRES__PASSWORD=postgres
POSTGRES__DB=index_db

# === Cache ===
REDIS__HOST=localhost
REDIS__PORT=6379
REDIS__PASSWORD=redis
REDIS__TTL_SECONDS=3600

# === Document Processing ===
CONVERTER__IMAGES_SCALE=2.0
CONVERTER__GENERATE_PAGE_IMAGES=true
CHUNKER__MAX_TOKENS=512

# === Security ===
SECURITY__SECRET_KEY=your-secret-key
SECURITY__ALGORITHM=RS256
```

## Processing Strategies

### Sentence-Based Chunking
- Splits text by sentences
- Maintains semantic coherence
- Best for: General documents, articles

### Page-Based Chunking
- Preserves page structure
- Includes page metadata
- Best for: PDFs with page references

### Excel Processing
- Extracts tabular data
- Converts to structured format
- Best for: Spreadsheets, data tables

### Document Structured
- Uses Docling for advanced parsing
- Extracts document structure
- Best for: Complex documents

### Vision LLM Processing
- OCR for scanned documents
- Image understanding
- Best for: Scanned PDFs, images

## Development

### Prerequisites
- Python 3.12+
- PostgreSQL 15+
- Qdrant (vector database)
- MinIO (object storage)
- Redis (caching)

### Installation

```bash
# Install dependencies
uv sync

# Run service
python main.py
```

### Docker Build

```bash
docker build -t index-service:latest .
docker run -p 8000:8000 --env-file .env index-service:latest
```

## Access Control

### Required Roles
- **Admin**: Full access to all operations
- **Manager**: Full access to all operations

### Role Assignment
Roles are managed in Keycloak. Users must have either `admin` or `manager` role in the `realm_access.roles` claim of their JWT token.

**Error Response (403):**
```json
{
  "detail": "Admin or Manager role required"
}
```

## Dependencies

```toml
fastapi==0.115.12
httpx==0.28.1
qdrant-client==1.12.1
minio==7.2.16
redis==5.0.8
openai==1.62.2
anthropic==0.45.1
google-generativeai==0.8.4
sqlalchemy==2.0.42
psycopg==3.2.5
markitdown==0.0.1a2
docling==2.21.2
structlog==25.4.0
```

## Troubleshooting

### Document Processing Fails
```
Error: "Failed to process document"
```
**Solution**: Check document format and size limits. Ensure LLM provider API keys are valid.

### Qdrant Connection Error
```
Error: "Could not connect to Qdrant"
```
**Solution**: Verify `QDRANT__HOST` and ensure Qdrant is running.

### MinIO Upload Error
```
Error: "Failed to upload to MinIO"
```
**Solution**: Check MinIO credentials and bucket existence.

## License

Proprietary - Fox AI Vietnam
