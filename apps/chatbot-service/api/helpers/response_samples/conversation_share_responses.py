"""
Conversation Share Response Samples for Query Service
"""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class ConversationShareResponseSamples(BaseResponseSamples):
    """Response samples for conversation share endpoints"""

    @staticmethod
    def create_share_responses() -> dict:
        """Response samples for POST /shares"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Share link created successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'share_id': '123e4567-e89b-12d3-a456-426614174000',
                            'share_token': '987fcdeb-51a2-43e7-b8c9-123456789abc',
                            'share_url': '/shared/987fcdeb-51a2-43e7-b8c9-123456789abc',
                        },
                    },
                },
            },
        }

        # Add not found and forbidden responses
        responses.update(
            BaseResponseSamples.add_not_found_response('Conversation'),
        )
        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses

    @staticmethod
    def get_shares_responses() -> dict:
        """Response samples for GET /shares/conversation/{conversation_id}"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Shares retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'shares': [
                                {
                                    'id': '123e4567-e89b-12d3-a456-426614174000',
                                    'conversation_id': '123e4567-e89b-12d3-a456-426614174001',
                                    'shared_by_user_id': '123e4567-e89b-12d3-a456-426614174002',
                                    'permission': 'view',
                                    'is_public': True,
                                    'share_token': '987fcdeb-51a2-43e7-b8c9-123456789abc',
                                    'created_at': '2026-02-02T10:30:00+07:00',
                                },
                            ],
                            'total_shares': 1,
                        },
                    },
                },
            },
        }

        return responses

    @staticmethod
    def delete_share_responses() -> dict:
        """Response samples for DELETE /shares/{share_id}"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Share revoked successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Share revoked successfully',
                        },
                    },
                },
            },
        }

        # Add not found response
        responses.update(
            BaseResponseSamples.add_not_found_response('Share'),
        )

        return responses

    @staticmethod
    def access_shared_responses() -> dict:
        """Response samples for GET /shared/{share_token}"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Shared conversation accessed successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'conversation_id': '123e4567-e89b-12d3-a456-426614174001',
                            'shared_by': '123e4567-e89b-12d3-a456-426614174002',
                            'messages': {
                                'messages': [
                                    {
                                        'message': {
                                            'id': '123e4567-e89b-12d3-a456-426614174010',
                                            'type': 'human',
                                            'contents': 'What is the policy?',
                                            'created_at': '2026-02-02T10:30:00+07:00',
                                        },
                                        'file_attachments': [],
                                    },
                                ],
                                'total': 1,
                                'page': 1,
                                'page_size': 50,
                                'total_pages': 1,
                            },
                        },
                    },
                },
            },
        }

        # Add not found response
        responses.update(
            BaseResponseSamples.add_not_found_response('Share'),
        )

        return responses
