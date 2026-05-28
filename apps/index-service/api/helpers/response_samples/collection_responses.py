"""
Collection Response Samples for Index Service
"""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class CollectionResponseSamples(BaseResponseSamples):
    """Response samples for collection endpoints"""

    @staticmethod
    def create_collection_responses() -> dict:
        """Response samples for POST /collections"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response (201 Created)
        responses[status.HTTP_201_CREATED] = {
            'description': 'Collection created successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': "Collection 'my_collection' created successfully",
                            'collection_id': '550e8400-e29b-41d4-a716-446655440000',
                            'collection_name': 'my_collection',
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
    def get_collection_responses() -> dict:
        """Response samples for GET /collections"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Collections retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'data': {
                                'collections': [
                                    {
                                        'id': '550e8400-e29b-41d4-a716-446655440000',
                                        'collection_name': 'my_collection',
                                        'description': 'My collection description',
                                        'user_id': '123e4567-e89b-12d3-a456-426614174000',
                                        'provider_embedding': 'openai',
                                        'provider_storage': 'qdrant',
                                        'created_at': '2026-01-15T10:00:00+07:00',
                                        'updated_at': '2026-01-15T10:00:00+07:00',
                                    },
                                ],
                                'total': 1,
                                'page': 1,
                                'page_size': 10,
                                'total_pages': 1,
                            },
                            'message': 'Collections retrieved successfully',
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

    @staticmethod
    def delete_collection_responses() -> dict:
        """Response samples for DELETE /collections/{collection_id}"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Collection deleted successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': "Collection 'my_collection' deleted successfully",
                            'collection_id': '550e8400-e29b-41d4-a716-446655440000',
                        },
                    },
                },
            },
        }

        # Add forbidden, not found, and validation error responses
        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_not_found_response('Collection'),
        )
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses
