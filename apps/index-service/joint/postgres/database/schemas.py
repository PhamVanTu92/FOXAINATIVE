from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Dict
from typing import Optional

import pytz
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import field_serializer

# Vietnam timezone
VIETNAM_TZ = pytz.timezone('Asia/Ho_Chi_Minh')


class UserType(str, Enum):
    ADMIN = 'admin'
    MANAGER = 'manager'
    USER = 'user'


class Identified(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)

    @field_serializer('id')
    def serialize_id(self, value: uuid.UUID) -> Optional[str]:
        return str(value) if value else None


class Dated(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None

        dt: datetime = value
        # If datetime is naive, assume it's in Vietnam timezone
        if dt.tzinfo is None:
            dt = VIETNAM_TZ.localize(dt)
        # If datetime has timezone, convert to Vietnam timezone
        else:
            dt = dt.astimezone(VIETNAM_TZ)

        return dt.isoformat()


class DatabaseSchema(Identified, Dated):
    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True,
    )


class Collection(DatabaseSchema):
    collection_name: str
    description: str
    user_id: uuid.UUID
    collection_style: Optional[str] = None
    creativity_level: Optional[float] = None

    @field_serializer('user_id')
    def serialize_user_id(self, value: uuid.UUID) -> Optional[str]:
        return str(value) if value else None


class Document(DatabaseSchema):
    """Document with integrated task tracking - Semantic naming"""
    display_name: str = Field(
        ..., description="Display name without extension (e.g., 'my_document')",
    )
    file_name: str = Field(
        ..., description="Original filename with extension (e.g., 'my_document.pdf')",
    )
    file_url: str = Field(..., description='MinIO public URL for file access')
    file_type: Optional[str] = Field(
        None, description="File extension (e.g., 'pdf', 'docx')",
    )
    file_size: Optional[int] = Field(None, description='File size in bytes')

    # Processing status fields
    processing_status: str = Field(
        default='pending', description='Processing status: pending, processing, completed, failed',
    )
    progress: int = Field(default=0, description='Progress percentage (0-100)')
    current_step: Optional[str] = Field(
        None, description='Current processing step: uploading, parsing, embedding, saving',
    )
    error_message: Optional[str] = Field(
        None, description='Error message if processing failed',
    )
    processing_type: Optional[str] = Field(
        None, description="Processing type: 'excel' or 'document_structured_llm' (None during upload, set during process)",
    )

    # Document metadata
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    issuing_unit: Optional[str] = None
    access_scope: Optional[str] = None
    version: Optional[str] = None
    completed_at: Optional[datetime] = Field(
        None, description='Processing completion timestamp',
    )

    # Foreign keys
    collection_id: uuid.UUID
    user_id: uuid.UUID

    @field_serializer('collection_id', 'user_id')
    def serialize_uuids(self, value: uuid.UUID) -> Optional[str]:
        return str(value) if value else None

    @field_serializer('effective_from', 'effective_to', 'completed_at')
    def serialize_datetimes(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None

        # If datetime is naive, assume it's in Vietnam timezone
        if value.tzinfo is None:
            localized_value = VIETNAM_TZ.localize(value)
        # If datetime has timezone, convert to Vietnam timezone
        else:
            localized_value = value.astimezone(VIETNAM_TZ)

        return localized_value.isoformat()


class Chunk(DatabaseSchema):
    """Schema for document chunks with Qdrant sync."""
    document_id: uuid.UUID
    user_id: uuid.UUID
    chunk_index: int
    content: str
    content_length: int
    qdrant_point_id: uuid.UUID
    chunk_metadata: Optional[Dict] = Field(None, alias='metadata')
    is_enabled: bool = True
    deleted: bool = False

    @field_serializer('document_id', 'user_id', 'qdrant_point_id')
    def serialize_uuids(self, value: uuid.UUID) -> Optional[str]:
        return str(value) if value else None

