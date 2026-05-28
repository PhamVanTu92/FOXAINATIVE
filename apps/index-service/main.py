from __future__ import annotations

import os
from contextlib import asynccontextmanager

from api.helpers import LoggingMiddleware
from api.routers.chunk_routers import create_chunk
from api.routers.chunk_routers import delete_chunk
from api.routers.chunk_routers import get_chunks
from api.routers.chunk_routers import toggle_chunk
from api.routers.chunk_routers import update_chunk
from api.routers.collection_routers import create_collection
from api.routers.collection_routers import delete_collection
from api.routers.collection_routers import get_collection
from api.routers.document_routers import batch_process
from api.routers.document_routers import batch_upload
from api.routers.document_routers import delete_document
from api.routers.document_routers import get_document
from api.routers.document_routers import get_document_by_id
from api.routers.document_routers import get_public_file
from api.routers.document_routers import get_public_image
from api.routers.internal_routers import get_collection_description
from api.routers.internal_routers import get_document_names
from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from api.helpers.dependencies.database import reset_database_instance
from infrastructure.embedding.embedding_providers.claude import ClaudeEmbeddingProvider
from infrastructure.embedding.embedding_providers.foxaillm import FoxAILLMEmbeddingProvider
from infrastructure.embedding.embedding_providers.gemini import GeminiEmbeddingProvider
from infrastructure.embedding.embedding_providers.openai import OpenAIEmbeddingProvider
from infrastructure.llm.llm_providers.claude import ClaudeProvider
from infrastructure.llm.llm_providers.foxaillm import FoxAILLMProvider
from infrastructure.llm.llm_providers.gemini import GeminiProvider
from infrastructure.llm.llm_providers.openai import OpenAIProvider
from infrastructure.llm_vision.llm_vision_providers.gemini import GeminiVisionProvider
from infrastructure.llm_vision.llm_vision_providers.openai import OpenAIVisionProvider
from infrastructure.storage.storage_providers.qdrant import QdrantStorageProvider
from joint.logging import get_logger
from joint.logging import setup_logging

logger = get_logger('api')
# setup_logging(json_logs=True, log_file='../../logs/app.json')
setup_logging(json_logs=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info('Starting application')

    # Defensive singleton resets (fork-safety for multi-worker mode)
    OpenAIEmbeddingProvider.reset_client()
    ClaudeEmbeddingProvider.reset_client()
    GeminiEmbeddingProvider.reset_client()
    FoxAILLMEmbeddingProvider.reset_client()
    QdrantStorageProvider.reset_client()
    OpenAIProvider.reset_client()
    ClaudeProvider.reset_client()
    GeminiProvider.reset_client()
    FoxAILLMProvider.reset_client()
    OpenAIVisionProvider.reset_client()
    GeminiVisionProvider.reset_client()
    reset_database_instance()
    logger.info('Singleton caches reset for this worker process')

    yield

    # Shutdown
    logger.info('Shutting down application')

    # Close shared HTTP client
    try:
        from joint.utils import close_shared_http_client
        await close_shared_http_client()
        logger.info('HTTP client closed')
    except Exception as e:
        logger.error(f"Error closing HTTP client: {e}")

    # Dispose database connection pools (async engine first, then sync)
    try:
        from api.helpers.dependencies.database import _database_instance

        if _database_instance is not None:
            await _database_instance.dispose_async()
            _database_instance.dispose_sync()
            reset_database_instance()
        logger.info('Database connection pools disposed')
    except Exception as e:
        logger.error(f"Error disposing database pools: {e}")

    # Close singleton connections (order: embedding -> storage -> llm -> llm_vision)
    try:
        OpenAIEmbeddingProvider.reset_client()
        ClaudeEmbeddingProvider.reset_client()
        GeminiEmbeddingProvider.reset_client()
        FoxAILLMEmbeddingProvider.reset_client()
        QdrantStorageProvider.reset_client()
        OpenAIProvider.reset_client()
        ClaudeProvider.reset_client()
        GeminiProvider.reset_client()
        FoxAILLMProvider.reset_client()
        OpenAIVisionProvider.reset_client()
        GeminiVisionProvider.reset_client()
        logger.info('Singleton connections closed')
    except Exception as e:
        logger.error(f"Error closing singleton connections: {e}")


app = FastAPI(
    title='INDEXING BACKEND FOXAI NATIVE',
    version='1.0.0',
    lifespan=lifespan,
    root_path=os.getenv('ROOT_PATH', ''),
)


# add middleware to generate correlation id
app.add_middleware(LoggingMiddleware, logger=logger)
app.add_middleware(CorrelationIdMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Custom API docs


@app.get('/docs', include_in_schema=False)
async def custom_swagger_ui_html():
    """Custom Swagger UI docs endpoint"""
    return get_swagger_ui_html(
        openapi_url=f'{app.root_path}{app.openapi_url}',
        title=f'{app.title} - API Documentation',
        swagger_js_url='https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js',
        swagger_css_url='https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css',
    )


# Health check endpoint
@app.get('/', tags=['health'])
async def root():
    """Root endpoint for health checks"""
    return {
        'service': 'index',
        'version': app.version,
        'status': 'healthy',
    }


app.include_router(
    create_collection.router,
    prefix='/v1/collections',
    tags=['collection'],
)

app.include_router(
    delete_collection.router,
    prefix='/v1/collections',
    tags=['collection'],
)

app.include_router(
    get_collection.router,
    prefix='/v1/collections',
    tags=['collection'],
)


app.include_router(
    batch_upload.router,
    prefix='/v1/collections',
    tags=['document'],
)

app.include_router(
    batch_process.router,
    prefix='/v1/collections',
    tags=['document'],
)

app.include_router(
    delete_document.router,
    prefix='/v1/documents',
    tags=['document'],
)

app.include_router(
    get_document.router,
    prefix='/v1/collections',
    tags=['document'],
)

app.include_router(
    get_document_by_id.router,
    prefix='/v1',
    tags=['document'],
)

# Public image router (no authentication required)
app.include_router(
    get_public_image.router,
    prefix='/v1',
    tags=['public-resources'],
)

# Public file router (no authentication required)
app.include_router(
    get_public_file.router,
    prefix='/v1',
    tags=['public-resources'],
)

# Chunk routers
app.include_router(
    get_chunks.router,
    prefix='/v1',
    tags=['chunk'],
)

app.include_router(
    create_chunk.router,
    prefix='/v1',
    tags=['chunk'],
)

app.include_router(
    update_chunk.router,
    prefix='/v1/chunks',
    tags=['chunk'],
)

app.include_router(
    toggle_chunk.router,
    prefix='/v1/chunks',
    tags=['chunk'],
)

app.include_router(
    delete_chunk.router,
    prefix='/v1/chunks',
    tags=['chunk'],
)

# Internal service-to-service endpoints (no authentication)
app.include_router(
    get_document_names.router,
    prefix='/v1/internal',
    tags=['internal'],
)

app.include_router(
    get_collection_description.router,
    prefix='/v1/internal',
    tags=['internal'],
)

if __name__ == '__main__':
    import uvicorn

    # Async workers already multiplex coroutines via event loop,
    # so cpu_count workers is sufficient. Override with UVICORN_WORKERS env var.
    _cpu_count = os.cpu_count() or 4
    _workers = int(os.getenv('UVICORN_WORKERS', str(_cpu_count)))

    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=8000,
        reload=False,
        workers=_workers,
        timeout_keep_alive=120,
        timeout_graceful_shutdown=60,
        limit_concurrency=100,
        backlog=2048,
    )
