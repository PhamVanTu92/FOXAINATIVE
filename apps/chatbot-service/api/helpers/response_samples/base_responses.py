"""
Base Response Samples - Common response structures for Query Service
"""
from __future__ import annotations

from api.helpers.exception_handler import ResponseMessage
from fastapi import status


class BaseResponseSamples:
    """Base class for response samples with common error responses"""

    @staticmethod
    def get_base_responses() -> dict:
        """Get common error responses used across all endpoints"""
        return {
            status.HTTP_400_BAD_REQUEST: {
                'description': 'Bad Request - Invalid input',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.BAD_REQUEST,
                        },
                    },
                },
            },
            status.HTTP_401_UNAUTHORIZED: {
                'description': 'Unauthorized - Invalid or expired token',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.UNAUTHORIZED,
                        },
                    },
                },
            },
            status.HTTP_500_INTERNAL_SERVER_ERROR: {
                'description': 'Internal Server Error',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.INTERNAL_SERVER_ERROR,
                        },
                    },
                },
            },
        }

    @staticmethod
    def add_forbidden_response() -> dict:
        """Add 403 Forbidden response for role-protected endpoints"""
        return {
            status.HTTP_403_FORBIDDEN: {
                'description': 'Forbidden - Insufficient permissions',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.FORBIDDEN,
                        },
                    },
                },
            },
        }

    @staticmethod
    def add_not_found_response(resource: str = 'Resource') -> dict:
        """Add 404 Not Found response"""
        return {
            status.HTTP_404_NOT_FOUND: {
                'description': f'{resource} not found',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.NOT_FOUND,
                        },
                    },
                },
            },
        }

    @staticmethod
    def add_unprocessable_entity_response() -> dict:
        """Add 422 Unprocessable Entity response"""
        return {
            status.HTTP_422_UNPROCESSABLE_ENTITY: {
                'description': 'Validation Error - Invalid request format',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.UNPROCESSABLE_ENTITY,
                        },
                    },
                },
            },
        }
