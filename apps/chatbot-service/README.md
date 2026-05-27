# Query Service

Intelligent query processing and conversational AI service for Robot Reception system. Handles user queries, conversation management, RAG (Retrieval-Augmented Generation), and agentic workflows.

## Overview

The Query service orchestrates the entire query pipeline: retrieving relevant documents from vector stores, augmenting LLM prompts with context, managing conversation history, and generating intelligent responses through agentic workflows.

## Architecture

Clean Architecture with streaming capabilities:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Routers)                       │
│  • Orchestrator endpoints (agentic chat, file upload)        │
│  • Conversation management                                   │
│  • Message retrieval                                         │
│  • Admin/cache management                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   App Layer (Services)                       │
│  • Query orchestration                                       │
│  • Conversation lifecycle                                    │
│  • Message handling                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Domain Layer (Services)                      │
│  • Agentic graph workflow (LangGraph)                        │
│  • Document retrieval from Qdrant                            │
│  • LLM orchestration                                         │
│  • Vision LLM for file processing                            │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│            Infrastructure Layer                              │
│  • Qdrant: Vector search                                     │
│  • PostgreSQL: Conversation/message storage                  │
│  • Redis: Graph state caching                                │
│  • LLM Providers: OpenAI, Claude, Gemini, FoxAI             │
│  • MinIO: File storage for uploads                           │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Conversational AI
- ✅ **Streaming Responses**: Real-time SSE streaming for chat
- ✅ **Agentic Workflow**: LangGraph-based reasoning and tool use
- ✅ **RAG Pipeline**: Retrieve-augment-generate with vector search
- ✅ **Multi-turn Conversations**: Context-aware dialogue management
- ✅ **File Understanding**: Upload and query documents/images

### Conversation Management
- ✅ **Create Conversations**: Auto-generated or custom titles
- ✅ **List Conversations**: Paginated with search
- ✅ **Update Conversations**: Edit title or soft delete
- ✅ **Delete Conversations**: Soft or hard delete
- ✅ **Message History**: Paginated message retrieval

### Advanced Features
- ✅ **Multi-LLM Support**: OpenAI, Claude, Gemini, FoxAI LLM
- ✅ **Vision LLM**: Process images and scanned documents
- ✅ **Tool Calling**: Web search (Tavily), Power BI integration
- ✅ **Graph State Caching**: Redis-based state persistence
- ✅ **Cache Management**: Admin endpoints for cache control

### Access Control
- ✅ **Public Endpoints**: Agentic chat, file upload (authenticated users)
- ✅ **Protected Endpoints**: Conversation/message management (admin/manager only)
- ✅ **JWT Authentication**: Keycloak integration

## API Endpoints

### Public Endpoints (Authenticated Users)

#### POST `/orchestrator/agentic`
Stream intelligent responses with RAG and tool use.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "message": "What are the company policies?",
  "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
  "provider_llm": "foxaillm",
  "provider_storage": "qdrant",
  "provider_embedding": "foxaillm",
  "collection_name": "company-docs",
  "file_metadata": [
    {
      "file_name": "document.pdf",
      "file_url": "https://minio.example.com/files/...",
      "markdown_content": "# Document content..."
    }
  ]
}
```

**Response (200 - SSE Stream):**
```
event: agent_start
data: {"type": "agent_start", "timestamp": "2024-01-01T10:00:00Z"}

event: thought
data: {"content": "I need to search for company policies...", "step": "retrieval"}

event: token
data: {"content": "Based on the company policies document..."}

event: agent_end
data: {"type": "agent_end", "conversation_id": "123e4567-...", "message_id": "456e7890-..."}
```

#### POST `/orchestrator/file-upload`
Upload and process file for chat context.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Form Data:**
- `file`: PDF, DOCX, XLSX, or image file
- `query` (optional): Question about the file
- `provider_name`: Vision provider (gemini-vision or openai-vision)

**Response (200):**
```json
{
  "message": "File processed successfully",
  "data": {
    "file_name": "document.pdf",
    "file_url": "https://minio.example.com/...",
    "markdown_content": "# Extracted content...",
    "file_size": 1024000,
    "processing_time": 2.5
  }
}
```

### Protected Endpoints (Admin/Manager Only)

#### GET `/conversations`
List conversations with pagination.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 10, max: 100)
- `include_deleted`: Include soft-deleted (default: false)
- `search`: Search by title

**Response (200):**
```json
{
  "message": "Conversations retrieved successfully",
  "data": {
    "conversations": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "title": "Company Policies Discussion",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "deleted": false,
        "created_at": "2024-01-01T10:00:00Z",
        "updated_at": "2024-01-01T11:00:00Z"
      }
    ],
    "total": 25,
    "page": 1,
    "page_size": 10,
    "total_pages": 3
  }
}
```

#### PUT `/conversations/{conversation_id}`
Update conversation title or soft delete.

**Request Body:**
```json
{
  "title": "Updated Title",
  "deleted": false
}
```

**Response (200):**
```json
{
  "message": "Conversation updated successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Updated Title",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

#### DELETE `/conversations/{conversation_id}`
Delete conversation (soft or hard).

**Query Parameters:**
- `hard_delete`: Permanent deletion (default: false)

**Response (200):**
```json
{
  "message": "Conversation deleted successfully",
  "conversation_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### GET `/conversations/{conversation_id}/messages`
Get messages for conversation.

**Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 10, max: 100)
- `search`: Search message content

**Response (200):**
```json
{
  "message": "Messages retrieved successfully",
  "data": {
    "messages": [
      {
        "id": "789e0123-e89b-12d3-a456-426614174000",
        "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
        "role": "user",
        "content": "What are the policies?",
        "created_at": "2024-01-01T10:00:00Z"
      },
      {
        "id": "789e0123-e89b-12d3-a456-426614174001",
        "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
        "role": "assistant",
        "content": "Based on the documents...",
        "created_at": "2024-01-01T10:00:05Z"
      }
    ],
    "total": 10,
    "page": 1,
    "page_size": 10,
    "total_pages": 1
  }
}
```

### Admin Endpoints

#### GET `/admin/cache`
Get cache information.

**Response (200):**
```json
{
  "total_keys": 150,
  "memory_usage": "2.5MB",
  "hit_rate": 0.85
}
```

#### POST `/admin/cache/clear`
Clear all cache.

#### POST `/admin/cache/cleanup`
Force cache cleanup.

## Configuration

### Environment Variables

```bash
# === LLM Providers ===
OPENAI__API_KEY=sk-...
OPENAI__MODEL_NAME=gpt-4o
GEMINI__API_KEY=...
GEMINI__MODEL_NAME=gemini-2.0-flash-exp
CLAUDE__API_KEY=...
CLAUDE__MODEL_NAME=claude-3-5-sonnet-20241022
FOXAILLM__API_KEY=...
FOXAILLM__BASE_URL=https://api.foxai.vn
FOXAILLM__MODEL_NAME=gpt-4o

# === Storage ===
QDRANT__HOST=http://localhost:6333
QDRANT__API_KEY=...
QDRANT__COLLECTION_NAME=default-collection

MINIO__HOST=localhost:9000
MINIO__USERNAME=minioadmin
MINIO__PASSWORD=minioadmin
MINIO__BUCKET_NAME=documents

# === Database ===
POSTGRES__HOST=localhost
POSTGRES__PORT=5432
POSTGRES__USERNAME=postgres
POSTGRES__PASSWORD=postgres
POSTGRES__DB=query_db

# === Cache ===
REDIS__HOST=localhost
REDIS__PORT=6379
REDIS__PASSWORD=redis
REDIS__TTL_SECONDS=3600

# === Tools ===
TAVILY__API_KEY=...  # Web search
POWERBI__CLIENT_ID=...
POWERBI__CLIENT_SECRET=...
POWERBI__TENANT_ID=...

# === Security ===
SECURITY__SECRET_KEY=your-secret-key
SECURITY__ALGORITHM=RS256

# === Monitoring ===
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=...
LANGSMITH_PROJECT=robot-reception
```

## Agentic Workflow

The service uses **LangGraph** for agentic reasoning:

```
User Query → Retrieval → Augmentation → Generation → Tools (optional) → Response
```

### Workflow Nodes
1. **Retrieval Node**: Search vector database for relevant docs
2. **LLM Node**: Generate response with retrieved context
3. **Tool Node**: Execute tools (web search, Power BI)
4. **Supervisor Node**: Decide next action

### State Management
- Graph state cached in Redis
- Conversation history in PostgreSQL
- Checkpointing for resumable workflows

## Access Control

### Public Endpoints
- `/orchestrator/agentic` - Any authenticated user
- `/orchestrator/file-upload` - Any authenticated user

### Protected Endpoints (Admin/Manager Only)
- `/conversations/*` - Conversation management
- `/conversations/{id}/messages` - Message retrieval
- `/admin/*` - Admin operations

### Role Assignment
Roles managed in Keycloak:
- **Public**: Any user with valid JWT token
- **Admin/Manager**: Users with `admin` or `manager` role in `realm_access.roles`

**Error Response (403):**
```json
{
  "detail": "Admin or Manager role required"
}
```

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

# Run migrations
alembic upgrade head

# Start service
python main.py
```

### Docker Build

```bash
docker build -t query-service:latest .
docker run -p 8000:8000 --env-file .env query-service:latest
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
langchain==0.3.18
langgraph==0.2.62
sqlalchemy==2.0.42
psycopg==3.2.5
sse-starlette==1.8.2
structlog==25.4.0
```

## Troubleshooting

### Streaming Not Working
```
Error: "SSE connection closed"
```
**Solution**: Check client SSE support and network proxies.

### Qdrant Retrieval Fails
```
Error: "No documents found"
```
**Solution**: Verify collection exists and has embeddings. Check embedding provider matches index service.

### Redis Connection Error
```
Error: "Could not connect to Redis"
```
**Solution**: Verify Redis credentials and network connectivity.

### LLM API Error
```
Error: "API key invalid"
```
**Solution**: Check provider API keys in environment variables.

## License

Proprietary - Fox AI Vietnam
