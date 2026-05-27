"""
Conversation Response Samples for Query Service
"""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class ConversationResponseSamples(BaseResponseSamples):
    """Response samples for conversation endpoints"""

    @staticmethod
    def get_conversation_responses() -> dict:
        """Response samples for GET /conversations"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Conversations retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'data': {
                                'conversations': [
                                    {
                                        'id': '123e4567-e89b-12d3-a456-426614174000',
                                        'title': 'Chat about Python',
                                        'user_id': '123e4567-e89b-12d3-a456-426614174001',
                                        'deleted': False,
                                        'created_at': '2026-01-25T10:00:00+07:00',
                                        'updated_at': '2026-01-25T10:00:00+07:00',
                                    },
                                ],
                                'total': 1,
                                'page': 1,
                                'page_size': 10,
                                'total_pages': 1,
                            },
                            'message': 'Conversations retrieved successfully',
                        },
                    },
                },
            },
        }

        # Add validation error response
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses

    @staticmethod
    def update_conversation_responses() -> dict:
        """Response samples for PUT /conversations/{conversation_id}"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Conversation updated successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Conversation updated successfully',
                        },
                    },
                },
            },
        }

        # Add not found response
        responses.update(
            BaseResponseSamples.add_not_found_response('Conversation'),
        )

        return responses

    @staticmethod
    def delete_conversation_responses() -> dict:
        """Response samples for DELETE /conversations/{conversation_id}"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Conversation deleted successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Conversation deleted successfully',
                        },
                    },
                },
            },
        }

        # Add not found response
        responses.update(
            BaseResponseSamples.add_not_found_response('Conversation'),
        )

        return responses

    @staticmethod
    def export_conversation_responses() -> dict:
        """Response samples for GET /conversations/export"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response for file download
        responses[status.HTTP_200_OK] = {
            'description': 'Conversations exported successfully to Excel file',
            'content': {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                    'example': 'Binary Excel file content',
                },
            },
            'headers': {
                'Content-Disposition': {
                    'description': 'Attachment with filename',
                    'example': 'attachment; filename="conversations_export_20260213_143052.xlsx"',
                },
            },
        }

        return responses
