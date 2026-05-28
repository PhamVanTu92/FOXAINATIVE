"""Dashboard response samples for Query service."""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class DashboardResponseSamples(BaseResponseSamples):
    """Response samples for dashboard metrics endpoints."""

    @staticmethod
    def overview_responses() -> dict:
        """Response samples for GET /dashboard/overview."""
        responses = BaseResponseSamples.get_base_responses()
        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(BaseResponseSamples.add_unprocessable_entity_response())

        responses[status.HTTP_200_OK] = {
            'description': 'Dashboard overview retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'filters': {
                                'period': 'month',
                                'from_timestamp': '2026-03-10T09:00:00+07:00',
                                'to_timestamp': '2026-04-09T09:00:00+07:00',
                                'timezone': 'Asia/Ho_Chi_Minh',
                                'granularity': 'day',
                            },
                            'summary': {
                                'total_chats': 1240,
                                'total_cost_usd': 13.482145,
                            },
                            'trend': [
                                {
                                    'time_bucket': '2026-04-01T00:00:00.000Z',
                                    'chats': 55,
                                    'total_cost_usd': 0.604515,
                                },
                            ],
                        },
                    },
                },
            },
        }

        return responses

    @staticmethod
    def users_responses() -> dict:
        """Response samples for GET /dashboard/users."""
        responses = BaseResponseSamples.get_base_responses()
        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(BaseResponseSamples.add_unprocessable_entity_response())

        responses[status.HTTP_200_OK] = {
            'description': 'Dashboard user usage retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'filters': {
                                'period': 'week',
                                'from_timestamp': '2026-04-02T09:00:00+07:00',
                                'to_timestamp': '2026-04-09T09:00:00+07:00',
                                'timezone': 'Asia/Ho_Chi_Minh',
                                'granularity': None,
                            },
                            'summary': {
                                'total_users_returned': 3,
                                'top_n': 10,
                                'sort_by': 'chats',
                                'sort_order': 'desc',
                            },
                            'items': [
                                {
                                    'rank': 1,
                                    'user_id': '2fcf45b6-f92a-4ce9-bfd7-55f7a3225f32',
                                    'total_chats': 124,
                                    'total_cost_usd': 1.15342,
                                },
                            ],
                        },
                    },
                },
            },
        }

        return responses
