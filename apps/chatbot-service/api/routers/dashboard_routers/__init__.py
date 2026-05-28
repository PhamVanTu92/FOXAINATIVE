from __future__ import annotations

from fastapi import APIRouter

from .get_overview import router as overview_router
from .get_user_usage import router as user_usage_router


dashboard_router = APIRouter()

dashboard_router.include_router(overview_router, tags=['dashboard'])
dashboard_router.include_router(user_usage_router, tags=['dashboard'])
