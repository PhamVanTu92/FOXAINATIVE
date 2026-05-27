"""Service for loading all messages in a conversation for state restoration."""
from __future__ import annotations

import uuid
from typing import List

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database.schemas import Message
from joint.settings.settings import PostgresSettings
from sqlalchemy import select

logger = get_logger(__name__)


class GettingAllMessagesByConversationInput(BaseModel):
    """Input model for loading all messages in a conversation.

    Attributes:
        conversation_id: UUID of the target conversation.
    """

    conversation_id: uuid.UUID


class GettingAllMessagesByConversationOutput(BaseModel):
    """Output model containing all messages for a conversation.

    Attributes:
        status: Whether the operation succeeded.
        message: Human-readable status description.
        data: List of messages ordered chronologically (oldest first).
    """

    status: bool
    message: str = ''
    data: List[Message] = []


class GettingAllMessagesByConversationService(BaseService):
    """Service to retrieve all messages for a conversation.

    Used for restoring LangGraph state from PostgreSQL
    when the Redis checkpointer cache has expired.

    Attributes:
        settings: PostgreSQL connection settings.
    """

    settings: PostgresSettings

    @cached_property
    def postgres_db(self) -> SQLDatabase:
        """Get shared postgres_db instance (cached per service)."""
        return SQLDatabase(
            host=self.settings.host,
            port=self.settings.port,
            db=self.settings.db,
            username=self.settings.username,
            password=self.settings.password,
        )

    def process(
        self,
        input: GettingAllMessagesByConversationInput,
        db=None,
    ) -> GettingAllMessagesByConversationOutput:
        """Load all messages for a conversation in chronological order.

        Args:
            input: Input containing the target conversation_id.
            db: Optional database session for connection reuse.

        Returns:
            Output with chronologically ordered message list.
        """
        if db is not None:
            return self._process_with_session(input, db)

        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(
                f"Error loading messages for conversation {input.conversation_id}: {e}",
            )
            return GettingAllMessagesByConversationOutput(
                status=False,
                message=f"Failed to retrieve messages: {e}",
            )

    def _process_with_session(
        self,
        input: GettingAllMessagesByConversationInput,
        db,
    ) -> GettingAllMessagesByConversationOutput:
        """Internal method that executes query with a provided session.

        Args:
            input: Input containing the target conversation_id.
            db: Active database session.

        Returns:
            Output with chronologically ordered message list.
        """
        try:
            from joint.postgres.models import Message as MessageModel

            stmt = (
                select(MessageModel)
                .filter_by(conversation_id=input.conversation_id)
                .order_by(MessageModel.created_at.asc())
            )

            results = db.execute(stmt).scalars().unique().all()
            messages = [Message.model_validate(m) for m in results]

            logger.info(
                f"Loaded {len(messages)} messages for conversation {input.conversation_id}",
            )

            return GettingAllMessagesByConversationOutput(
                status=True,
                message=f"Successfully loaded {len(messages)} messages",
                data=messages,
            )

        except Exception as e:
            logger.error(
                f"Error querying messages for conversation {input.conversation_id}: {e}",
                exc_info=True,
            )
            return GettingAllMessagesByConversationOutput(
                status=False,
                message=f"Failed to retrieve messages: {e}",
            )
