from __future__ import annotations

from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import DashboardResponseSamples
from app.dashboard import DashboardPeriod
from app.dashboard import DashboardUserUsageInput
from app.dashboard import DashboardUserUsageService
from app.dashboard import SortOrder
from app.dashboard import UserSortBy
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
    dashboard_user_usage_service = DashboardUserUsageService(settings=settings)
    logger.info('Dashboard user usage service initialized successfully')
except Exception as exc:
    logger.error(f'Failed to initialize dashboard user usage service: {exc}')
    raise RuntimeError(
        f'Dashboard user usage service initialization failed: {exc}',
    )


@router.get(
    '/dashboard/users',
    summary='Get dashboard user usage metrics',
    description='Retrieve ranked users by chat volume or cost for a selected rolling period.',
    responses=DashboardResponseSamples.users_responses(),
    status_code=status.HTTP_200_OK,
)
async def get_dashboard_user_usage(
    period: DashboardPeriod = Query(
        DashboardPeriod.MONTH,
        description='Rolling period: day, week, month, three_months, six_months, one_year',
    ),
    top_n: int = Query(
        10,
        ge=1,
        le=100,
        description='Number of users to return (max 100)',
    ),
    sort_by: UserSortBy = Query(
        UserSortBy.CHATS,
        description='Sort users by chats or cost',
    ),
    sort_order: SortOrder = Query(
        SortOrder.DESC,
        description='Sort direction: asc or desc',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
):
    """Get dashboard user usage ranking for manager/admin users."""
    exception_handler = ExceptionHandler(
        logger=logger.bind(),
        service_name=__name__,
    )

    try:
        logger.info(
            f'Getting dashboard user usage - period={period.value}, top_n={top_n}, sort_by={sort_by.value}, sort_order={sort_order.value}, user={current_user.user_id}',
        )

        service_input = DashboardUserUsageInput(
            period=period,
            top_n=top_n,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        result = await dashboard_user_usage_service.process(service_input)

        if not result.status or result.data is None:
            return exception_handler.handle_exception(
                e=result.message or 'Failed to retrieve dashboard user usage',
                extra={
                    'endpoint': 'get_dashboard_user_usage',
                    'period': period.value,
                    'top_n': top_n,
                    'sort_by': sort_by.value,
                    'sort_order': sort_order.value,
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Dashboard user usage retrieved successfully - period={period.value}, top_n={top_n}, user={current_user.user_id}',
        )
        return exception_handler.handle_success(
            output=result.data.model_dump(mode='json'),
        )

    except Exception as exc:
        logger.error(
            f'Failed to get dashboard user usage - period={period.value}, top_n={top_n}, user={current_user.user_id}: {exc}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve dashboard user usage: {exc}',
            extra={
                'endpoint': 'get_dashboard_user_usage',
                'period': period.value,
                'top_n': top_n,
                'sort_by': sort_by.value,
                'sort_order': sort_order.value,
                'user_id': str(current_user.user_id),
                'error': str(exc),
            },
        )
