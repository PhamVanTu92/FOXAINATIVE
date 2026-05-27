from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any
from typing import Dict
from typing import List
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


class MessageType(str, Enum):
    HUMAN = 'human'
    AI = 'ai'


class SharePermission(str, Enum):
    VIEW = 'view'
    EDIT = 'edit'
    ADMIN = 'admin'


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


class Conversation(DatabaseSchema):
    title: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    chatbot_id: Optional[uuid.UUID] = None
    deleted: bool = False

    @field_serializer('user_id', 'chatbot_id')
    def serialize_uuids(self, value: Optional[uuid.UUID]) -> Optional[str]:
        return str(value) if value else None


class Message(DatabaseSchema):
    type: MessageType
    contents: str
    conversation_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    artifacts: Optional[Dict] = None  # Artifact data from tool executions

    @field_serializer('conversation_id', 'user_id')
    def serialize_uuids(self, value: Optional[uuid.UUID]) -> Optional[str]:
        return str(value) if value else None


class ConversationFileAttachment(DatabaseSchema):
    """Schema for file attachments in conversation messages."""
    user_id: uuid.UUID
    conversation_id: Optional[uuid.UUID] = None
    message_id: Optional[uuid.UUID] = None
    file_name: str
    file_type: str
    file_size: Optional[int] = None
    storage_path: str
    extracted_content: Optional[str] = None
    processing_status: str = 'pending'
    error_message: Optional[str] = None

    @field_serializer('user_id', 'conversation_id', 'message_id')
    def serialize_uuids(self, value: Optional[uuid.UUID]) -> Optional[str]:
        return str(value) if value else None


class ChatbotForm(str, Enum):
    CHAT = 'chat'
    VOICE = 'voice'
    BOTH = 'both'


class ChatbotPurpose(str, Enum):
    CUSTOMER_CARE = 'customer_care'
    SALES = 'sales'
    TECH_SUPPORT = 'tech_support'
    OTHER = 'other'


class FAQItem(BaseModel):
    question: str
    answer: str


class ChatbotCollectionRef(BaseModel):
    collection_id: uuid.UUID
    collection_name: str

    @field_serializer('collection_id')
    def serialize_collection_id(self, value: uuid.UUID) -> str:
        return str(value)


class Chatbot(DatabaseSchema):
    """User-configurable chatbot schema."""
    user_id: uuid.UUID
    name: str
    purpose: str = ChatbotPurpose.CUSTOMER_CARE.value
    form: str = ChatbotForm.CHAT.value
    description: Optional[str] = None

    system_prompt: Optional[str] = None
    faqs: Optional[List[Dict[str, Any]]] = None

    llm_provider: Optional[str] = None
    embedding_provider: Optional[str] = None

    welcome_message: Optional[str] = None
    widget_theme: Optional[Dict[str, Any]] = None

    public_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    is_active: bool = True
    is_widget_active: bool = False

    @field_serializer('user_id', 'public_id')
    def serialize_uuids(self, value: uuid.UUID) -> Optional[str]:
        return str(value) if value else None


class ConversationShare(DatabaseSchema):
    """Schema for public share links of conversations."""
    conversation_id: uuid.UUID
    shared_by_user_id: uuid.UUID
    permission: SharePermission = SharePermission.VIEW
    is_public: bool = True
    share_token: uuid.UUID = Field(default_factory=uuid.uuid4)
    expires_at: Optional[datetime] = None

    @field_serializer('conversation_id', 'shared_by_user_id', 'share_token')
    def serialize_uuids(self, value: Optional[uuid.UUID]) -> Optional[str]:
        return str(value) if value else None

    @field_serializer('expires_at')
    def serialize_expires_at(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        dt: datetime = value
        if dt.tzinfo is None:
            dt = VIETNAM_TZ.localize(dt)
        else:
            dt = dt.astimezone(VIETNAM_TZ)
        return dt.isoformat()
