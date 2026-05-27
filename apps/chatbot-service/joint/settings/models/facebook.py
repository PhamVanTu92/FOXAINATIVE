"""Facebook Messenger Platform settings."""
from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class FacebookSettings(BaseModel):
    """Configuration for Facebook Messenger Platform integration."""

    page_access_token: str = Field(
        default='',
        description='Facebook Page Access Token for Send API.',
    )
    verify_token: str = Field(
        default='my_verify_token_123',
        description='Webhook verification token (must match Facebook Developer Console).',
    )
    app_secret: str = Field(
        default='',
        description='Facebook App Secret for webhook signature verification.',
    )
    app_id: str = Field(
        default='',
        description='Facebook App ID.',
    )
    api_version: str = Field(
        default='v21.0',
        description='Facebook Graph API version.',
    )
