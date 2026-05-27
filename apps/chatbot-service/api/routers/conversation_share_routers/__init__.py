from __future__ import annotations

from fastapi import APIRouter

from .access_shared import router as access_shared_router
from .create_share import router as create_router
from .delete_share import router as delete_router
from .get_share import router as get_router

conversation_share_router = APIRouter()

# Authenticated endpoints
conversation_share_router.include_router(create_router, tags=['conversation-shares'])
conversation_share_router.include_router(get_router, tags=['conversation-shares'])
conversation_share_router.include_router(delete_router, tags=['conversation-shares'])

# Public endpoint (no auth required)
conversation_share_router.include_router(access_shared_router, tags=['conversation-shares'])
