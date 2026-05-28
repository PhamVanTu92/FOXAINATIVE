"""Langfuse configuration model for dashboard metrics APIs."""
from __future__ import annotations

import os

from joint.base import BaseModel
from pydantic import Field
from pydantic import field_validator


class LangfuseSettings(BaseModel):
    """Configuration for Langfuse Metrics API access."""

    public_key: str = Field(
        default_factory=lambda: os.getenv('LANGFUSE_PUBLIC_KEY', ''),
        description='Langfuse public key used for basic authentication.',
    )
    secret_key: str = Field(
        default_factory=lambda: os.getenv('LANGFUSE_SECRET_KEY', ''),
        description='Langfuse secret key used for basic authentication.',
    )
    host: str = Field(
        default_factory=lambda: os.getenv('LANGFUSE_HOST', ''),
        description='Langfuse base host URL.',
    )
    request_timeout_seconds: float = Field(
        default=30.0,
        description='HTTP timeout for Langfuse metrics requests.',
    )

    @field_validator('host', mode='before')
    @classmethod
    def normalize_host(cls, value: str) -> str:
        """Normalize Langfuse host by trimming spaces and trailing slash."""
        return (value or '').strip().rstrip('/')

    @property
    def is_configured(self) -> bool:
        """Return True when all required Langfuse credentials are present."""
        return bool(self.host and self.public_key and self.secret_key)
