from __future__ import annotations

from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import DashboardResponseSamples
from app.dashboard import DashboardOverviewInput
from app.dashboard import DashboardOverviewService
from app.dashboard import DashboardPeriod
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    dashboard_overview_service = DashboardOverviewService(settings=settings)
    logger.info('Dashboard overview service initialized successfully')
except Exception as exc:
    logger.error(f'Failed to initialize dashboard overview service: {exc}')
    raise RuntimeError(
        f'Dashboard overview service initialization failed: {exc}',
    )


@router.get(
    '/dashboard/overview',
    summary='Get dashboard overview metrics',
    description='Retrieve total chats, total cost, and trend for a selected rolling period.',
    responses=DashboardResponseSamples.overview_responses(),
    status_code=status.HTTP_200_OK,
)
async def get_dashboard_overview(
    period: DashboardPeriod = Query(
        DashboardPeriod.MONTH,
        description='Rolling period: day, week, month, three_months, six_months, one_year',
    ),
    include_trend: bool = Query(
        True,
        description='Include trend buckets in the response',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
):
    """Get dashboard overview for manager/admin users."""
    exception_handler = ExceptionHandler(
        logger=logger.bind(),
        service_name=__name__,
    )

    try:
        logger.info(
            f'Getting dashboard overview - period={period.value}, include_trend={include_trend}, user={current_user.user_id}',
        )

        service_input = DashboardOverviewInput(
            period=period,
            include_trend=include_trend,
        )
        result = await dashboard_overview_service.process(service_input)

        if not result.status or result.data is None:
            return exception_handler.handle_exception(
                e=result.message or 'Failed to retrieve dashboard overview',
                extra={
                    'endpoint': 'get_dashboard_overview',
                    'period': period.value,
                    'include_trend': include_trend,
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Dashboard overview retrieved successfully - period={period.value}, user={current_user.user_id}',
        )
        return exception_handler.handle_success(
            output=result.data.model_dump(mode='json'),
        )

    except Exception as exc:
        logger.error(
            f'Failed to get dashboard overview - period={period.value}, user={current_user.user_id}: {exc}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve dashboard overview: {exc}',
            extra={
                'endpoint': 'get_dashboard_overview',
                'period': period.value,
                'include_trend': include_trend,
                'user_id': str(current_user.user_id),
                'error': str(exc),
            },
        )
