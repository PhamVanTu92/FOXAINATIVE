from __future__ import annotations

import uuid
from datetime import datetime

import pytz
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

# Vietnam timezone
VIETNAM_TZ = pytz.timezone('Asia/Ho_Chi_Minh')


def get_vietnam_now():
    """Get current time in Vietnam timezone"""
    return datetime.now(VIETNAM_TZ)


class Base(DeclarativeBase):
    pass


class Dated(Base):
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        insert_default=get_vietnam_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        insert_default=get_vietnam_now,
        onupdate=get_vietnam_now,
        nullable=False,
    )


class Identified(Base):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True,
    )


class Collection(Identified, Dated):
    __tablename__ = 'collections'
    collection_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
    )
    collection_style: Mapped[str] = mapped_column(String, nullable=True)
    creativity_level: Mapped[float] = mapped_column(nullable=True)

    # Relationships
    # Note: user_id comes from Keycloak authentication (no FK constraints)
    # Collection belongs to user only (no organization concept)
    documents = relationship('Document', back_populates='collection')


class Document(Identified, Dated):
    __tablename__ = 'documents'
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_url: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=True)
    file_size: Mapped[int] = mapped_column(nullable=True)

    # Processing status fields
    processing_status: Mapped[str] = mapped_column(
        String, nullable=False, default='pending',
    )
    progress: Mapped[int] = mapped_column(nullable=False, default=0)
    current_step: Mapped[str] = mapped_column(String, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    # Allow None during upload, set during process
    processing_type: Mapped[str] = mapped_column(String, nullable=True)

    # Document metadata
    effective_from: Mapped[datetime] = mapped_column(nullable=True)
    effective_to: Mapped[datetime] = mapped_column(nullable=True)
    issuing_unit: Mapped[str] = mapped_column(String, nullable=True)
    access_scope: Mapped[str] = mapped_column(String, nullable=True)
    version: Mapped[str] = mapped_column(String, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Foreign keys
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('collections.id', ondelete='CASCADE'), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
    )

    # Relationships
    collection = relationship('Collection', back_populates='documents')
    chunks = relationship('Chunk', back_populates='document', cascade='all, delete-orphan')
    # Note: user_id comes from Keycloak authentication (no FK constraint)


class Chunk(Identified, Dated):
    """Chunk model for storing document chunks with Qdrant sync."""
    __tablename__ = 'chunks'

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_length: Mapped[int] = mapped_column(Integer, nullable=False)
    qdrant_point_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True,
    )
    chunk_metadata: Mapped[dict] = mapped_column(JSONB, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )
    deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )

    # Relationships
    document = relationship('Document', back_populates='chunks')
