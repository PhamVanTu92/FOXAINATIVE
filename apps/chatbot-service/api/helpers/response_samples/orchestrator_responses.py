"""
Orchestrator Response Samples for Query Service
"""
from __future__ import annotations

from api.helpers.exception_handler import ResponseMessage
from fastapi import status

from .base_responses import BaseResponseSamples


class OrchestratorResponseSamples(BaseResponseSamples):
    """Response samples for orchestrator endpoints"""

    # ── Facebook Messenger ─────────────────────────────────────────────

    @staticmethod
    def facebook_verify_responses() -> dict:
        """Response samples for GET /facebook/webhook (verification)."""
        return {
            status.HTTP_200_OK: {
                'description': 'Webhook verified successfully — returns hub.challenge as plain text',
                'content': {
                    'text/plain': {
                        'example': '1234567890',
                    },
                },
            },
            status.HTTP_403_FORBIDDEN: {
                'description': 'Forbidden — hub.verify_token does not match configured token',
                'content': {
                    'text/plain': {
                        'example': 'Forbidden',
                    },
                },
            },
        }

    @staticmethod
    def facebook_webhook_responses() -> dict:
        """Response samples for POST /facebook/webhook (incoming messages)."""
        return {
            status.HTTP_200_OK: {
                'description': 'Message received and queued for background processing',
                'content': {
                    'application/json': {
                        'examples': {
                            'accepted': {
                                'summary': 'Message accepted for processing',
                                'value': {'status': 'ok'},
                            },
                            'ignored': {
                                'summary': 'Non-page event acknowledged',
                                'value': {'status': 'ignored'},
                            },
                        },
                    },
                },
            },
            status.HTTP_400_BAD_REQUEST: {
                'description': 'Bad Request — invalid JSON body',
                'content': {
                    'application/json': {
                        'example': {'error': 'Invalid JSON'},
                    },
                },
            },
            status.HTTP_403_FORBIDDEN: {
                'description': 'Forbidden — X-Hub-Signature-256 verification failed',
                'content': {
                    'application/json': {
                        'example': {'error': 'Invalid signature'},
                    },
                },
            },
            status.HTTP_500_INTERNAL_SERVER_ERROR: {
                'description': 'Internal Server Error',
                'content': {
                    'application/json': {
                        'example': {'message': ResponseMessage.INTERNAL_SERVER_ERROR},
                    },
                },
            },
        }

    # ── WhatsApp ────────────────────────────────────────────────────────

    @staticmethod
    def whatsapp_verify_responses() -> dict:
        """Response samples for GET /whatsapp/webhook (Meta verification)."""
        return {
            status.HTTP_200_OK: {
                'description': 'Webhook verified successfully — returns hub.challenge as plain text',
                'content': {
                    'text/plain': {
                        'example': '1234567890',
                    },
                },
            },
            status.HTTP_403_FORBIDDEN: {
                'description': 'Forbidden — hub.verify_token does not match configured token',
                'content': {
                    'text/plain': {
                        'example': 'Forbidden',
                    },
                },
            },
        }

    @staticmethod
    def whatsapp_webhook_responses() -> dict:
        """Response samples for POST /whatsapp/webhook (incoming messages)."""
        return {
            status.HTTP_200_OK: {
                'description': 'Message received and queued for background processing',
                'content': {
                    'application/json': {
                        'examples': {
                            'accepted': {
                                'summary': 'Message accepted for processing',
                                'value': {'status': 'ok'},
                            },
                            'ignored': {
                                'summary': 'Non-message event acknowledged',
                                'value': {'status': 'ignored'},
                            },
                        },
                    },
                },
            },
            status.HTTP_400_BAD_REQUEST: {
                'description': 'Bad Request — invalid JSON body',
                'content': {
                    'application/json': {
                        'example': {'error': 'Invalid JSON'},
                    },
                },
            },
            status.HTTP_403_FORBIDDEN: {
                'description': 'Forbidden — X-Hub-Signature-256 verification failed',
                'content': {
                    'application/json': {
                        'example': {'error': 'Invalid signature'},
                    },
                },
            },
            status.HTTP_500_INTERNAL_SERVER_ERROR: {
                'description': 'Internal Server Error',
                'content': {
                    'application/json': {
                        'example': {'message': ResponseMessage.INTERNAL_SERVER_ERROR},
                    },
                },
            },
        }

    """Response samples for orchestrator endpoints"""

    @staticmethod
    def agentic_stream_responses() -> dict:
        """Response samples for POST /chat/stream"""
        responses = {
            status.HTTP_200_OK: {
                'description': 'Streaming response started successfully (SSE format)',
                'content': {
                    'text/event-stream': {
                        'example': (
                            'data: {"name":"agent","type":"message_chunk","id":"run--08671bb5-5ac2-42a4-9982-c34faca16b37",'
                            '"content":"Hello","language":"","finishReason":"","artifact":null, "conversation_id":"uuid-123"}\n\n'
                            'data: {"name":"agent","type":"message_chunk","id":"run--08671bb5-5ac2-42a4-9982-c34faca16b37",'
                            '"content":" world","language":"","finishReason":"","artifact":null,"conversation_id":"uuid-123"}'
                        ),
                    },
                    'application/json': {
                        'example': {
                            'note': 'SSE stream format - each chunk is a separate data: line',
                            'chunk_structure': {
                                'name': 'agent',
                                'type': 'message_chunk',
                                'id': 'run--08671bb5-5ac2-42a4-9982-c34faca16b37',
                                'content': 'Token fragment (char/word)',
                                'language': '',
                                'finishReason': '',
                                'artifact': None,
                                'conversation_id': 'uuid-123',
                            },
                        },
                    },
                },
            },
            status.HTTP_400_BAD_REQUEST: {
                'description': 'Bad Request - message is required or exceeds limits',
                'content': {
                    'application/json': {
                        'examples': {
                            'missing_message': {
                                'summary': 'Missing message',
                                'value': {
                                    'message': ResponseMessage.BAD_REQUEST,
                                },
                            },
                            'message_too_long': {
                                'summary': 'Message exceeds token limit',
                                'value': {
                                    'message': 'Message too long. Maximum 8000 tokens allowed, got 10000. Please shorten your message.',
                                },
                            },
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
            status.HTTP_404_NOT_FOUND: {
                'description': 'Destination Not Found',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.NOT_FOUND,
                        },
                    },
                },
            },
            status.HTTP_422_UNPROCESSABLE_ENTITY: {
                'description': 'Unprocessable Entity - Format is not supported',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.UNPROCESSABLE_ENTITY,
                        },
                    },
                },
            },
            status.HTTP_500_INTERNAL_SERVER_ERROR: {
                'description': 'Internal Server Error - Error during conversation',
                'content': {
                    'application/json': {
                        'example': {
                            'message': ResponseMessage.INTERNAL_SERVER_ERROR,
                        },
                    },
                },
            },
        }

        return responses
