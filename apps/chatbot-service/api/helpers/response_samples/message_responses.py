"""
Message Response Samples for Query Service
"""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class MessageResponseSamples(BaseResponseSamples):
    """Response samples for message endpoints"""

    @staticmethod
    def get_message_responses() -> dict:
        """Response samples for GET /conversations/{conversation_id}/messages"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Messages retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'data': {
                                'messages': [
                                    {
                                        'message': {
                                            'id': '123e4567-e89b-12d3-a456-426614174000',
                                            'type': 'human',
                                            'contents': 'Please analyze these documents',
                                            'user_id': '123e4567-e89b-12d3-a456-426614174001',
                                            'created_at': '2026-01-25T10:00:00+07:00',
                                            'updated_at': '2026-01-25T10:00:00+07:00',
                                        },
                                    },
                                    {
                                        'message': {
                                            'id': '123e4567-e89b-12d3-a456-426614174002',
                                            'type': 'ai',
                                            'contents': 'I have analyzed the request...',
                                            'user_id': '123e4567-e89b-12d3-a456-426614174001',
                                            'created_at': '2026-01-25T10:01:00+07:00',
                                            'updated_at': '2026-01-25T10:01:00+07:00',
                                        },
                                    },
                                ],
                                'total': 2,
                                'page': 1,
                                'page_size': 10,
                                'total_pages': 1,
                            },
                            'message': 'Messages retrieved successfully',
                        },
                    },
                },
            },
        }

        # Add forbidden and validation error responses
        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses
