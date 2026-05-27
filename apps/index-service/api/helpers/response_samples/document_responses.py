"""
Document Response Samples for Index Service
"""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class DocumentResponseSamples(BaseResponseSamples):
    """Response samples for document endpoints"""

    @staticmethod
    def batch_upload_responses() -> dict:
        """Response samples for POST /{collection_id}/documents/batch-upload"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response (201 Created)
        responses[status.HTTP_201_CREATED] = {
            'description': 'Batch upload completed successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Batch upload completed: 5 files uploaded successfully',
                            'documents': [
                                {
                                    'document_id': '123e4567-e89b-12d3-a456-426614174000',
                                    'file_name': 'document1.pdf',
                                    'display_name': 'document1',
                                    'file_url': 'https://minio.example.com/files/bucket/uuid_document1.pdf',
                                    'file_size': 1024000,
                                    'status': 'pending',
                                },
                                {
                                    'document_id': '223e4567-e89b-12d3-a456-426614174001',
                                    'file_name': 'document2.pdf',
                                    'display_name': 'document2',
                                    'file_url': 'https://minio.example.com/files/bucket/uuid_document2.pdf',
                                    'file_size': 2048000,
                                    'status': 'pending',
                                },
                            ],
                            'successful_count': 5,
                            'failed_count': 0,
                            'total_count': 5,
                        },
                    },
                },
            },
        }

        return responses

    @staticmethod
    def batch_process_responses() -> dict:
        """Response samples for POST /{collection_id}/documents/batch-process"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response (202 Accepted)
        responses[status.HTTP_202_ACCEPTED] = {
            'description': 'Batch processing started',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': 'Batch processing started for 5 documents',
                            'document_ids': [
                                '123e4567-e89b-12d3-a456-426614174000',
                                '223e4567-e89b-12d3-a456-426614174001',
                            ],
                            'processing_status': 'processing',
                            'total_count': 5,
                        },
                    },
                },
            },
        }

        # Add not found response
        responses.update(
            BaseResponseSamples.add_not_found_response(
                'Documents or collection',
            ),
        )

        return responses

    @staticmethod
    def get_document_responses() -> dict:
        """Response samples for GET /{collection_id}/documents"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Documents retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'data': {
                                'documents': [
                                    {
                                        'id': '123e4567-e89b-12d3-a456-426614174000',
                                        'display_name': 'example_document',
                                        'file_name': 'example_document.pdf',
                                        'file_url': 'https://minio.example.com/bucket/file.pdf',
                                        'file_type': 'pdf',
                                        'file_size': 1024576,
                                        'processing_status': 'completed',
                                        'progress': 100,
                                        'processing_type': 'document_structured_llm',
                                        'collection_id': '123e4567-e89b-12d3-a456-426614174001',
                                        'user_id': '123e4567-e89b-12d3-a456-426614174002',
                                        'created_at': '2026-01-20T10:00:00+07:00',
                                        'updated_at': '2026-01-20T10:30:00+07:00',
                                    },
                                ],
                                'total': 1,
                                'page': 1,
                                'page_size': 10,
                                'total_pages': 1,
                            },
                            'message': 'Successfully retrieved documents',
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
    def get_document_by_id_responses() -> dict:
        """Response samples for GET /documents/{document_id}"""
        responses = {}

        # Only add 401 and 500 (no 400 for UUID path param)
        responses[status.HTTP_401_UNAUTHORIZED] = {
            'description': 'Unauthorized - Invalid or expired token',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Unauthorized',
                    },
                },
            },
        }

        responses[status.HTTP_500_INTERNAL_SERVER_ERROR] = {
            'description': 'Internal Server Error',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Internal Server Error',
                    },
                },
            },
        }

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Document retrieved successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'id': '123e4567-e89b-12d3-a456-426614174000',
                            'display_name': 'example_document',
                            'file_name': 'example_document.pdf',
                            'file_url': 'https://minio.example.com/bucket/file.pdf',
                            'file_type': 'pdf',
                            'file_size': 1024576,
                            'processing_status': 'completed',
                            'progress': 100,
                            'current_step': None,
                            'error_message': None,
                            'processing_type': 'document_structured_llm',
                            'effective_from': None,
                            'effective_to': None,
                            'issuing_unit': None,
                            'access_scope': None,
                            'version': '1.0',
                            'completed_at': '2026-01-20T10:30:00+07:00',
                            'collection_id': '123e4567-e89b-12d3-a456-426614174001',
                            'user_id': '123e4567-e89b-12d3-a456-426614174002',
                            'collection_name': 'my_collection',
                            'created_at': '2026-01-20T10:00:00+07:00',
                            'updated_at': '2026-01-20T10:30:00+07:00',
                        },
                    },
                },
            },
        }

        # Add forbidden and not found responses
        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_not_found_response('Document'),
        )

        return responses

    @staticmethod
    def delete_document_responses() -> dict:
        """Response samples for DELETE /{document_id}"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Document deleted successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Process successfully !!!',
                        'info': {
                            'message': "Document 'my_document.pdf' deleted successfully",
                            'document_id': '550e8400-e29b-41d4-a716-446655440000',
                        },
                    },
                },
            },
        }

        # Add forbidden, not found, and validation error responses
        responses.update(BaseResponseSamples.add_forbidden_response())
        responses.update(
            BaseResponseSamples.add_not_found_response('Document'),
        )
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses
