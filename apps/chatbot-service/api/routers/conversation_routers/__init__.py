from __future__ import annotations

from fastapi import APIRouter

from .delete_conversation import router as delete_router
from .export_conversation import router as export_router
from .get_conversation import router as get_router
from .update_conversation import router as update_router

conversation_router = APIRouter()

# Include all conversation routers
conversation_router.include_router(export_router, tags=['conversations'])
conversation_router.include_router(get_router, tags=['conversations'])
conversation_router.include_router(update_router, tags=['conversations'])
conversation_router.include_router(delete_router, tags=['conversations'])
