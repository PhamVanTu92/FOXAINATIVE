from __future__ import annotations

import asyncio
import concurrent.futures
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse
from asgi_correlation_id import CorrelationIdMiddleware

from api.helpers import LoggingMiddleware
from api.routers.chatbot_routers import public_router as chatbot_public_router
from api.routers.chatbot_routers import router as chatbot_router
from api.routers.tts_routers.tts_router import router as tts_router
from api.routers.conversation_routers import conversation_router
from api.routers.conversation_share_routers import conversation_share_router
from api.routers.dashboard_routers import dashboard_router
from api.routers.file_routers import file_router
from api.routers.message_routers import get_message_router
from api.routers.orchestrator_routers import agentic
from api.routers.orchestrator_routers.agentic_public import router as public_orchestrator_router
from api.routers.orchestrator_routers.whatsapp import router as whatsapp_router
from api.routers.orchestrator_routers.facebook import router as facebook_router
from api.routers.orchestrator_routers.facebook_tmp import router as facebook_tmp_router
from api.helpers.dependencies.database import reset_database_instance
from domain.storage_services.qdrant.client import reset_vectorstore_cache
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
from infrastructure.memory import CheckpointerFactory
from infrastructure.memory import Mem0Factory
from infrastructure.storage.storage_providers.qdrant import QdrantStorageProvider
from joint.logging import get_logger
from joint.logging import setup_logging
from joint.settings import Settings

logger = get_logger('api')
# setup_logging(json_logs=True, log_file='../../logs/app.json')
setup_logging(json_logs=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info('Starting application')

    # Expand threadpool for asyncio.to_thread() calls in THIS worker process.
    # Must be set here (not before uvicorn.run) because multi-worker mode
    # forks child processes, each with a fresh event loop.
    # I/O-bound workload: allocate up to 5 threads per CPU (mirrors Python's own
    # default formula), capped at 80 to avoid thrashing on very large machines.
    _cpu_count = os.cpu_count() or 4
    _max_workers = min(_cpu_count * 5, 80)
    loop = asyncio.get_running_loop()
    loop.set_default_executor(
        concurrent.futures.ThreadPoolExecutor(max_workers=_max_workers),
    )
    logger.info(f'Threadpool executor set to {_max_workers} workers for this process (cpu_count={_cpu_count})')

    # ── Defensive singleton resets ──────────────────────────────────
    # All module-level singletons start as None and are lazily
    # initialized, so they are safe across fork().  These resets
    # provide defence-in-depth: if any future import side-effect
    # accidentally triggers client creation before the fork, this
    # guarantees each worker starts with a clean slate.
    reset_vectorstore_cache()
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

    # Initialize checkpointer (warm up connection)
    try:
        settings = Settings()
        backend = settings.redis.checkpointer_backend
        await CheckpointerFactory.get_checkpointer(settings, backend=backend)
        logger.info(
            f"Checkpointer initialized successfully with backend: {backend}",
        )
    except Exception as e:
        logger.error(f"Failed to initialize checkpointer: {e}")

    # Initialize Mem0 personalization memory (warm up connection)
    try:
        if settings.mem0.enabled:
            await Mem0Factory.get_instance(settings)
            logger.info('Mem0 AsyncMemory initialized successfully')
        else:
            logger.info('Mem0 personalization is disabled')
    except Exception as e:
        logger.error(f"Failed to initialize Mem0 (non-fatal): {e}")
        # Continue startup - will retry on first request

    # Initialize Langfuse observability client (reads LANGFUSE_* env vars)
    try:
        from langfuse import Langfuse
        Langfuse()
        logger.info('Langfuse client initialized successfully')
    except Exception as e:
        logger.error(f"Failed to initialize Langfuse (non-fatal): {e}")

    yield

    # Shutdown
    logger.info('Shutting down application')

    # Close HTTP client
    try:
        from joint.utils import close_shared_http_client
        await close_shared_http_client()
        logger.info('HTTP client closed')
    except Exception as e:
        logger.error(f"Error closing HTTP client: {e}")

    # Close checkpointer
    try:
        await CheckpointerFactory.close()
        logger.info('Checkpointer closed')
    except Exception as e:
        logger.error(f"Error closing checkpointer: {e}")

    # Close Mem0
    try:
        await Mem0Factory.close()
        logger.info('Mem0 closed')
    except Exception as e:
        logger.error(f"Error closing Mem0: {e}")

    # Flush and shutdown Langfuse client
    try:
        from langfuse import get_client
        langfuse_client = get_client()
        langfuse_client.flush()
        langfuse_client.shutdown()
        logger.info('Langfuse client shut down')
    except Exception as e:
        logger.error(f"Error shutting down Langfuse: {e}")

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

    # Close singleton connections (order: vectorstore -> embedding -> storage -> llm -> llm_vision)
    try:
        reset_vectorstore_cache()
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
    title='QUERY BACKEND FOXAI NATIVE',
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

# Widget static files directory
widget_dir = os.path.join(os.path.dirname(__file__), 'widget')
if os.path.exists(widget_dir):
    logger.info(f"Widget static files directory found: {widget_dir}")
else:
    logger.warning(f"Widget directory not found: {widget_dir}")

# SDK JavaScript file endpoint
@app.get('/dist/sdk.js', tags=['static'])
async def serve_sdk_js():
    """Serve SDK JavaScript file"""
    sdk_file_path = os.path.join(os.path.dirname(__file__), 'widget', 'sdk', 'dist', 'sdk.js')
    
    if os.path.exists(sdk_file_path):
        return FileResponse(
            path=sdk_file_path,
            media_type='application/javascript',
            filename='sdk.js',
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*',
            }
        )
    else:
        raise HTTPException(status_code=404, detail="SDK file not found")

# Widget static files endpoint (replaces app.mount due to root_path incompatibility with StaticFiles)
@app.get('/widget/{file_path:path}', tags=['static'])
async def serve_widget_static(file_path: str):
    """Serve widget static files (images, CSS, etc.)"""
    import mimetypes
    safe_path = os.path.normpath(file_path)
    if safe_path.startswith('..') or os.path.isabs(safe_path):
        raise HTTPException(status_code=403, detail="Access denied")
    
    full_path = os.path.join(widget_dir, safe_path)
    
    if os.path.exists(full_path) and os.path.isfile(full_path):
        content_type, _ = mimetypes.guess_type(full_path)
        return FileResponse(
            path=full_path,
            media_type=content_type or 'application/octet-stream',
            headers={
                'Cache-Control': 'public, max-age=31536000',
                'Access-Control-Allow-Origin': '*',
            }
        )
    else:
        raise HTTPException(status_code=404, detail="File not found")

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
        'service': 'query',
        'version': app.version,
        'status': 'healthy',
    }

# Conversation routers
app.include_router(
    conversation_router,
    prefix='/v1',
    tags=['conversations'],
)


# Message routers
app.include_router(
    get_message_router,
    prefix='/v1',
    tags=['message'],
)



# Dashboard routers
app.include_router(
    dashboard_router,
    prefix='/v1',
    tags=['dashboard'],
)



# Orchestrator routers
app.include_router(
    agentic.router,
    prefix='/v1/agents',
    tags=['orchestrator'],
)

# Public Orchestrator routers (no auth required)
app.include_router(
    public_orchestrator_router,
    prefix='/v1/agents/public',
    tags=['orchestrator'],
)

# WhatsApp webhook routers (no auth — Meta signature verification)
app.include_router(
    whatsapp_router,
    prefix='/v1/agents/whatsapp',
    tags=['whatsapp'],
)

# Facebook Messenger webhook routers (no auth — Facebook signature verification)
app.include_router(
    facebook_router,
    prefix='/v1/agents/facebook',
    tags=['facebook'],
)

# Facebook TMP webhook routers (isolated temp flow)
app.include_router(
    facebook_tmp_router,
    prefix='/v1/agents/facebook-tmp',
    tags=['facebook-tmp'],
)


# File upload routers
app.include_router(
    file_router,
    prefix='/v1',
    tags=['files'],
)

# Conversation share routers
app.include_router(
    conversation_share_router,
    prefix='/v1',
    tags=['conversation-shares'],
)

# Chatbot CRUD (foxai-native — authenticated owner endpoints)
app.include_router(
    chatbot_router,
    prefix='/v1',
    tags=['chatbots'],
)

# Public chatbot config (no auth — consumed by the embed widget)
app.include_router(
    chatbot_public_router,
    prefix='/v1/public',
    tags=['chatbots-public'],
)

# Public TTS endpoint (foxai-native voice mode)
app.include_router(
    tts_router,
    prefix='/v1/tts',
    tags=['tts'],
)


if __name__ == '__main__':
    import uvicorn

    # For async workers (Uvicorn/ASGI), the "2N+1" formula is for sync Gunicorn workers.
    # Async workers already multiplex thousands of coroutines per process via the event loop,
    # so cpu_count workers is sufficient. More workers = more DB/Redis/Qdrant connections
    # opened simultaneously, which exhausts connection pools and causes crash loops.
    # Allow override via env var for tuning without code changes.
    _cpu_count = os.cpu_count() or 4
    _workers = int(os.getenv('UVICORN_WORKERS', str(_cpu_count)))

    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=8000,
        reload=False,
        workers=_workers,  # Dynamic: cpu_count (override with UVICORN_WORKERS env var)
        # Increase to 10 minutes for long-running operations like summarization
        timeout_keep_alive=600,
        timeout_graceful_shutdown=60,  # Increase graceful shutdown time
        # Concurrency limit to prevent overload (fixes 425 PIDs issue)
        limit_concurrency=100,  # Max concurrent connections per worker
        backlog=2048,  # Queue size for pending connections
    )
