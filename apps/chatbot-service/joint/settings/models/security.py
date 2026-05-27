from __future__ import annotations

import secrets

from joint.base import BaseModel
from pydantic import Field


class SecuritySettings(BaseModel):
    secret_key: str = Field(
        default=secrets.token_urlsafe(32),
        description='Secret key for security operations.',
    )
    access_token_expire_minutes: int = Field(
        30,
        description='Access token expiration time in minutes.',
    )
    refresh_token_expire_days: int = Field(
        7,
        description='Refresh token expiration time in days.',
    )
    algorithm: str = Field(
        'HS256',
        description='Algorithm used for token signing.',
    )
