"""WhatsApp Business Cloud API settings."""
from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class WhatsAppSettings(BaseModel):
    """Configuration for WhatsApp Business Cloud API integration."""

    access_token: str = Field(
        default='',
        description='WhatsApp Business Cloud API permanent access token.',
    )
    verify_token: str = Field(
        default='my_verify_token_123',
        description='Webhook verification token (must match Meta Developer Console).',
    )
    phone_number_id: str = Field(
        default='',
        description='WhatsApp Business phone number ID.',
    )
    app_secret: str = Field(
        default='',
        description='Meta App secret for webhook signature verification.',
    )
    api_version: str = Field(
        default='v21.0',
        description='Facebook Graph API version.',
    )
