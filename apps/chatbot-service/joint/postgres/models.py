from __future__ import annotations

import uuid
from datetime import datetime

import pytz
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import JSON
from sqlalchemy import PrimaryKeyConstraint
from sqlalchemy import String
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


class Conversation(Identified, Dated):
    __tablename__ = 'conversations'
    # Có thể để trống, auto-generate từ message đầu tiên
    title: Mapped[str] = mapped_column(String, nullable=True)
    # Nullable for anonymous embed sessions (chatbot widget on third-party sites).
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True,
    )
    # Bound chatbot (NULL for legacy/owner-direct conversations).
    chatbot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey('chatbots.id', ondelete='SET NULL'), nullable=True, index=True,
    )
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    messages = relationship(
        'Message', back_populates='conversation', cascade='all, delete-orphan',
    )


class Message(Identified, Dated):
    __tablename__ = 'messages'
    type: Mapped[str] = mapped_column(String, nullable=False)
    contents: Mapped[str] = mapped_column(String, nullable=False)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False,
    )
    # Nullable for anonymous embed sessions.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True,
    )
    # Artifact data from tool executions (JSON)
    artifacts: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment='Structured data artifacts from agent tools',
    )
    # Relationships
    conversation = relationship('Conversation', back_populates='messages')
    file_attachments = relationship(
        'ConversationFileAttachment', back_populates='message', cascade='all, delete-orphan',
    )


class ConversationFileAttachment(Identified, Dated):
    """File attachments uploaded in conversation chat messages."""
    __tablename__ = 'conversation_file_attachments'

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey('conversations.id', ondelete='CASCADE'), nullable=True, index=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey('messages.id', ondelete='SET NULL'), nullable=True, index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int | None] = mapped_column(nullable=True)
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    extracted_content: Mapped[str | None] = mapped_column(
        String, nullable=True, comment='Extracted text content from file processing',
    )
    processing_status: Mapped[str] = mapped_column(
        String(20), default='pending', nullable=False,
        comment='Processing status: pending, processing, success, failed',
    )
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)

    # Relationships
    conversation = relationship('Conversation')
    message = relationship('Message', back_populates='file_attachments')


class Chatbot(Identified, Dated):
    """User-configurable chatbot definition (foxai-native MVP)."""
    __tablename__ = 'chatbots'

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
    )
    # Display fields
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(
        String(64), nullable=False, default='customer_care',
    )
    form: Mapped[str] = mapped_column(
        String(16), nullable=False, default='chat',
    )
    description: Mapped[str | None] = mapped_column(String, nullable=True)

    # Scenario
    system_prompt: Mapped[str | None] = mapped_column(String, nullable=True)
    faqs: Mapped[list | None] = mapped_column(
        JSONB, nullable=True,
        comment='List of {question, answer} pairs',
    )

    # Provider overrides (NULL = use defaults)
    llm_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    embedding_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Widget settings
    welcome_message: Mapped[str | None] = mapped_column(String, nullable=True)
    widget_theme: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Public exposure
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
    )
    # foxai-native: the user-facing FE_Native site embeds one widget; this
    # flag picks which of the user's chatbots that widget should load.
    # A partial unique index guarantees at most one ``true`` per user.
    is_widget_active: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
    )

    collections = relationship(
        'ChatbotCollection',
        back_populates='chatbot',
        cascade='all, delete-orphan',
    )


class ChatbotCollection(Dated):
    """Many-to-many binding from a chatbot to index-service collections.

    Stores ``collection_name`` as a snapshot so retrieval doesn't need a
    cross-service call on each chat turn.
    """
    __tablename__ = 'chatbot_collections'

    chatbot_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('chatbots.id', ondelete='CASCADE'), nullable=False,
    )
    # UUID from index service; not FK because it lives in a different DB.
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    collection_name: Mapped[str] = mapped_column(String(255), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint(
            'chatbot_id', 'collection_id', name='pk_chatbot_collections',
        ),
        Index('ix_chatbot_collections_chatbot_id', 'chatbot_id'),
    )

    chatbot = relationship('Chatbot', back_populates='collections')


class ConversationShare(Identified, Dated):
    """Public share links for conversations."""
    __tablename__ = 'conversation_shares'

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False, index=True,
    )
    shared_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
    )
    permission: Mapped[str] = mapped_column(
        String(20), default='view', nullable=False,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    share_token: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Relationships
    conversation = relationship('Conversation')
