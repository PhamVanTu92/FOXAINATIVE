"""Dashboard metrics services for overview and user usage analytics."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from datetime import timedelta
from enum import Enum
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings
from joint.utils import get_shared_http_client
from pydantic import Field

logger = get_logger(__name__)

TIMEZONE_NAME = 'Asia/Ho_Chi_Minh'
TIMEZONE = ZoneInfo(TIMEZONE_NAME)
METRIC_DEFINITIONS = [
    {'measure': 'count', 'aggregation': 'count'},
    {'measure': 'totalCost', 'aggregation': 'sum'},
]


class DashboardPeriod(str, Enum):
    """Supported dashboard periods using rolling windows."""

    DAY = 'day'
    WEEK = 'week'
    MONTH = 'month'
    THREE_MONTHS = 'three_months'
    SIX_MONTHS = 'six_months'
    ONE_YEAR = 'one_year'


class UserSortBy(str, Enum):
    """Sort fields for user usage API."""

    CHATS = 'chats'
    COST = 'cost'


class SortOrder(str, Enum):
    """Sort direction for user usage API."""

    ASC = 'asc'
    DESC = 'desc'


_PERIOD_DAYS: dict[DashboardPeriod, int] = {
    DashboardPeriod.DAY: 1,
    DashboardPeriod.WEEK: 7,
    DashboardPeriod.MONTH: 30,
    DashboardPeriod.THREE_MONTHS: 90,
    DashboardPeriod.SIX_MONTHS: 180,
    DashboardPeriod.ONE_YEAR: 365,
}


class DashboardFilterInfo(BaseModel):
    """Normalized filters metadata returned in dashboard responses."""

    period: DashboardPeriod
    from_timestamp: str
    to_timestamp: str
    timezone: str = TIMEZONE_NAME
    granularity: str | None = None


class DashboardOverviewSummary(BaseModel):
    """Overview summary values for the selected rolling period."""

    total_chats: int
    total_cost_usd: float


class DashboardOverviewTrendItem(BaseModel):
    """Single chart bucket for overview trend data."""

    time_bucket: str
    chats: int
    total_cost_usd: float


class DashboardOverviewData(BaseModel):
    """Overview payload returned to API layer."""

    filters: DashboardFilterInfo
    summary: DashboardOverviewSummary
    trend: list[DashboardOverviewTrendItem] = Field(default_factory=list)


class DashboardOverviewInput(BaseModel):
    """Input for overview dashboard service."""

    period: DashboardPeriod = DashboardPeriod.MONTH
    include_trend: bool = True


class DashboardOverviewOutput(BaseModel):
    """Output for overview dashboard service."""

    status: bool
    message: str = ''
    data: DashboardOverviewData | None = None


class DashboardUserUsageItem(BaseModel):
    """Single user usage row returned to frontend."""

    rank: int
    user_id: str
    total_chats: int
    total_cost_usd: float


class DashboardUserUsageSummary(BaseModel):
    """Metadata summary for user usage response."""

    total_users_returned: int
    top_n: int
    sort_by: UserSortBy
    sort_order: SortOrder


class DashboardUserUsageData(BaseModel):
    """User usage payload returned to API layer."""

    filters: DashboardFilterInfo
    summary: DashboardUserUsageSummary
    items: list[DashboardUserUsageItem] = Field(default_factory=list)


class DashboardUserUsageInput(BaseModel):
    """Input for user usage dashboard service."""

    period: DashboardPeriod = DashboardPeriod.MONTH
    top_n: int = Field(default=10, ge=1, le=100)
    sort_by: UserSortBy = UserSortBy.CHATS
    sort_order: SortOrder = SortOrder.DESC


class DashboardUserUsageOutput(BaseModel):
    """Output for user usage dashboard service."""

    status: bool
    message: str = ''
    data: DashboardUserUsageData | None = None


class LangfuseMetricsClient(BaseModel):
    """Minimal Langfuse Metrics API client for dashboard services."""

    settings: Settings

    @property
    def metrics_endpoint(self) -> str:
        """Return normalized metrics endpoint."""
        host = self.settings.langfuse.host.rstrip('/')
        return f"{host}/api/public/metrics"

    async def fetch_metrics(
        self,
        query_payload: dict[str, Any],
        description: str,
    ) -> list[dict[str, Any]]:
        """Fetch metrics rows from Langfuse public metrics API."""
        if not self.settings.langfuse.is_configured:
            raise ValueError('Langfuse metrics credentials are not configured')

        logger.info(f'Fetching Langfuse metrics: {description}')

        client = await get_shared_http_client()

        try:
            response = await client.get(
                self.metrics_endpoint,
                params={'query': json.dumps(query_payload)},
                auth=(
                    self.settings.langfuse.public_key,
                    self.settings.langfuse.secret_key,
                ),
                timeout=self.settings.langfuse.request_timeout_seconds,
                follow_redirects=True,
            )
            response.raise_for_status()

            payload = response.json()
            if not isinstance(payload, dict):
                return []

            rows = payload.get('data', [])
            if isinstance(rows, list):
                return rows
            return []

        except httpx.HTTPStatusError as exc:
            redirect_location = exc.response.headers.get('location')
            logger.error(
                f'Langfuse HTTP error {exc.response.status_code} for {description}: {exc.response.text} '
                f'(location={redirect_location})',
            )
            raise RuntimeError(
                f'Langfuse request failed for {description}: HTTP {exc.response.status_code}',
            ) from exc
        except Exception as exc:
            logger.error(
                f'Unexpected Langfuse error while fetching {description}: {exc}',
            )
            raise RuntimeError(
                f'Langfuse request failed for {description}: {exc}',
            ) from exc


def _to_int(value: Any) -> int:
    """Safely cast incoming metric value to int."""
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _to_float(value: Any) -> float:
    """Safely cast incoming metric value to float."""
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _build_time_filters(period: DashboardPeriod) -> dict[str, str]:
    """Build rolling window time filters in Asia/Ho_Chi_Minh timezone."""
    to_time = datetime.now(TIMEZONE)
    from_time = to_time - timedelta(days=_PERIOD_DAYS[period])

    return {
        'fromTimestamp': from_time.isoformat(),
        'toTimestamp': to_time.isoformat(),
    }


def _resolve_overview_granularity(period: DashboardPeriod) -> str:
    """Select trend granularity for overview chart."""
    if period in {DashboardPeriod.DAY, DashboardPeriod.WEEK, DashboardPeriod.MONTH}:
        return 'day'
    return 'month'


class DashboardOverviewService(BaseService):
    """Service for dashboard overview summary and trend."""

    settings: Settings

    @property
    def langfuse_client(self) -> LangfuseMetricsClient:
        """Return Langfuse API client instance."""
        return LangfuseMetricsClient(settings=self.settings)

    async def process(self, inputs: DashboardOverviewInput) -> DashboardOverviewOutput:
        """Process overview request and return summary and trend data."""
        try:
            time_filters = _build_time_filters(inputs.period)
            granularity = _resolve_overview_granularity(inputs.period)

            summary_query = {
                'view': 'traces',
                'metrics': METRIC_DEFINITIONS,
                **time_filters,
            }

            summary_task = self.langfuse_client.fetch_metrics(
                summary_query,
                'dashboard-overview-summary',
            )

            trend_rows: list[dict[str, Any]] = []
            if inputs.include_trend:
                trend_query = {
                    'view': 'traces',
                    'metrics': METRIC_DEFINITIONS,
                    'timeDimension': {'granularity': granularity},
                    **time_filters,
                }

                summary_rows, trend_rows = await asyncio.gather(
                    summary_task,
                    self.langfuse_client.fetch_metrics(
                        trend_query,
                        'dashboard-overview-trend',
                    ),
                )
            else:
                summary_rows = await summary_task

            total_chats = sum(_to_int(row.get('count_count')) for row in summary_rows)
            total_cost_usd = sum(_to_float(row.get('sum_totalCost')) for row in summary_rows)

            trend = [
                DashboardOverviewTrendItem(
                    time_bucket=str(row.get('time_dimension') or ''),
                    chats=_to_int(row.get('count_count')),
                    total_cost_usd=_to_float(row.get('sum_totalCost')),
                )
                for row in trend_rows
            ]

            return DashboardOverviewOutput(
                status=True,
                message='Dashboard overview retrieved successfully',
                data=DashboardOverviewData(
                    filters=DashboardFilterInfo(
                        period=inputs.period,
                        from_timestamp=time_filters['fromTimestamp'],
                        to_timestamp=time_filters['toTimestamp'],
                        granularity=granularity if inputs.include_trend else None,
                    ),
                    summary=DashboardOverviewSummary(
                        total_chats=total_chats,
                        total_cost_usd=total_cost_usd,
                    ),
                    trend=trend,
                ),
            )

        except Exception as exc:
            logger.error(f'Failed to retrieve dashboard overview: {exc}')
            return DashboardOverviewOutput(
                status=False,
                message=f'Failed to retrieve dashboard overview: {exc}',
            )


class DashboardUserUsageService(BaseService):
    """Service for dashboard user usage ranking."""

    settings: Settings

    @property
    def langfuse_client(self) -> LangfuseMetricsClient:
        """Return Langfuse API client instance."""
        return LangfuseMetricsClient(settings=self.settings)

    async def process(self, inputs: DashboardUserUsageInput) -> DashboardUserUsageOutput:
        """Process user usage request and return ranked users."""
        try:
            time_filters = _build_time_filters(inputs.period)
            order_field = 'count_count' if inputs.sort_by == UserSortBy.CHATS else 'sum_totalCost'

            users_query = {
                'view': 'traces',
                'metrics': METRIC_DEFINITIONS,
                'dimensions': [{'field': 'userId'}],
                'orderBy': [
                    {
                        'field': order_field,
                        'direction': inputs.sort_order.value,
                    },
                ],
                'filters': [],
                **time_filters,
            }

            rows = await self.langfuse_client.fetch_metrics(
                users_query,
                'dashboard-user-usage',
            )

            items: list[DashboardUserUsageItem] = []
            for rank, row in enumerate(rows[:inputs.top_n], start=1):
                user_id = str(row.get('userId') or '').strip() or 'Unknown/Guest'
                items.append(
                    DashboardUserUsageItem(
                        rank=rank,
                        user_id=user_id,
                        total_chats=_to_int(row.get('count_count')),
                        total_cost_usd=_to_float(row.get('sum_totalCost')),
                    ),
                )

            return DashboardUserUsageOutput(
                status=True,
                message='Dashboard user usage retrieved successfully',
                data=DashboardUserUsageData(
                    filters=DashboardFilterInfo(
                        period=inputs.period,
                        from_timestamp=time_filters['fromTimestamp'],
                        to_timestamp=time_filters['toTimestamp'],
                    ),
                    summary=DashboardUserUsageSummary(
                        total_users_returned=len(items),
                        top_n=inputs.top_n,
                        sort_by=inputs.sort_by,
                        sort_order=inputs.sort_order,
                    ),
                    items=items,
                ),
            )

        except Exception as exc:
            logger.error(f'Failed to retrieve dashboard user usage: {exc}')
            return DashboardUserUsageOutput(
                status=False,
                message=f'Failed to retrieve dashboard user usage: {exc}',
            )
