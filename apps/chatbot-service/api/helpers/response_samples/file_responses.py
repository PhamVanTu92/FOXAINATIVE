"""
File Response Samples for Query Service
"""
from __future__ import annotations

from fastapi import status

from .base_responses import BaseResponseSamples


class FileResponseSamples(BaseResponseSamples):
    """Response samples for file upload endpoints"""

    @staticmethod
    def upload_file_responses() -> dict:
        """Response samples for POST /files/upload"""
        responses = BaseResponseSamples.get_base_responses()

        # Add success response
        responses[status.HTTP_200_OK] = {
            'description': 'Files uploaded and processed successfully',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Uploaded 2 file(s) successfully',
                        'files': [
                            {
                                'file_id': '123e4567-e89b-12d3-a456-426614174000',
                                'file_name': 'report.pdf',
                                'file_type': 'pdf',
                                'file_size': 1048576,
                                'storage_url': 'http://minio:9000/files-attachment/user-id/file-id.pdf',
                                'processing_status': 'completed',
                            },
                            {
                                'file_id': '123e4567-e89b-12d3-a456-426614174001',
                                'file_name': 'photo.png',
                                'file_type': 'png',
                                'file_size': 524288,
                                'storage_url': 'http://minio:9000/files-attachment/user-id/file-id.png',
                                'processing_status': 'completed',
                            },
                        ],
                        'errors': [],
                    },
                },
            },
        }

        # Add validation error response
        responses.update(
            BaseResponseSamples.add_unprocessable_entity_response(),
        )

        return responses
