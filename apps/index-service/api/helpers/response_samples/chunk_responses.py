"""Chunk Response Samples for Index Service."""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class ChunkResponseSamples(BaseResponseSamples):
    """Response samples for chunk endpoints."""

    @staticmethod
    def get_chunks_responses() -> dict:
        """Response samples for GET /documents/{document_id}/chunks."""
        responses = BaseResponseSamples.get_base_responses()

        responses[status.HTTP_200_OK] = {
            'description': 'Chunks retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'chunks': [
                                {
                                    'id': '550e8400-e29b-41d4-a716-446655440000',
                                    'document_id': '123e4567-e89b-12d3-a456-426614174000',
                                    'chunk_index': 0,
                                    'content': 'Chunk text content...',
                                    'content_length': 256,
                                    'qdrant_point_id': '660e8400-e29b-41d4-a716-446655440001',
                                    'is_enabled': True,
                                    'deleted': False,
                                    'created_at': '2026-02-20T10:00:00+07:00',
                                    'updated_at': '2026-02-20T10:00:00+07:00',
                                },
                            ],
                            'total': 15,
                            'enabled': 14,
                            'disabled': 1,
                            'page': 1,
                            'page_size': 10,
                            'total_pages': 2,
                        },
                    },
                },
            },
        }

        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses

    @staticmethod
    def create_chunk_responses() -> dict:
        """Response samples for POST /documents/{document_id}/chunks."""
        responses = BaseResponseSamples.get_base_responses()

        responses[status.HTTP_201_CREATED] = {
            'description': 'Chunk created successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Chunk created successfully',
                            'chunk_id': '550e8400-e29b-41d4-a716-446655440000',
                        },
                    },
                },
            },
        }

        responses.update(
            BaseResponseSamples.add_not_found_response('Document'),
        )
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses

    @staticmethod
    def update_chunk_responses() -> dict:
        """Response samples for PUT /chunks/{chunk_id}."""
        responses = BaseResponseSamples.get_base_responses()

        responses[status.HTTP_200_OK] = {
            'description': 'Chunk updated successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Chunk updated successfully',
                        },
                    },
                },
            },
        }

        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_not_found_response('Chunk'),
        )
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses

    @staticmethod
    def toggle_chunk_responses() -> dict:
        """Response samples for PATCH /chunks/{chunk_id}/toggle."""
        responses = BaseResponseSamples.get_base_responses()

        responses[status.HTTP_200_OK] = {
            'description': 'Chunk toggled successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Chunk enabled successfully',
                        },
                    },
                },
            },
        }

        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_not_found_response('Chunk'),
        )
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses

    @staticmethod
    def delete_chunk_responses() -> dict:
        """Response samples for DELETE /chunks/{chunk_id}."""
        responses = BaseResponseSamples.get_base_responses()

        responses[status.HTTP_200_OK] = {
            'description': 'Chunk deleted successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Chunk soft deleted successfully',
                        },
                    },
                },
            },
        }

        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_not_found_response('Chunk'),
        )
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses
