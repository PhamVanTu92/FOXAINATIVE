from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class MinIOSettings(BaseModel):
    host: str = Field(
        ...,
        description='MinIO host URL for internal communication.',
    )
    username: str = Field(
        ...,
        description='MinIO username.',
    )
    password: str = Field(
        ...,
        description='MinIO password.',
    )
    ssl: bool = Field(
        False,
        description='Enable SSL for MinIO.',
    )
    debug: bool = Field(
        True,
        description='Enable debug mode for MinIO.',
    )
    bucket_name: str = Field(
        'chatbot-foxai',
        description='Default bucket name for MinIO.',
    )
    attachment_bucket_name: str = Field(
        'files-attachment',
        description='Bucket name for conversation file attachments.',
    )
    public_url_base: str = Field(
        ...,
        description='Public URL base for accessing MinIO from external clients (e.g., http://localhost:17000, https://minio.yourdomain.com).',
    )
