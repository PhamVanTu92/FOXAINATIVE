from __future__ import annotations

import uuid
from typing import List

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationShareController
from joint.postgres.database.schemas import ConversationShare
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GettingConversationShareInput(BaseModel):
    """Input model for getting all shares of a conversation."""
    conversation_id: uuid.UUID


class GettingConversationShareOutput(BaseModel):
    """Output model for getting all shares of a conversation."""
    status: bool
    message: str = ''
    shares: List[ConversationShare] = []
    total_shares: int = 0


class GettingConversationShareService(BaseService):
    """Service to get all shares for a conversation."""

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

    @property
    def share_controller(self) -> ConversationShareController:
        """Get conversation share controller instance."""
        return ConversationShareController()

    def process(
        self, input: GettingConversationShareInput, db=None,
    ) -> GettingConversationShareOutput:
        """Get all shares for a conversation.

        Args:
            input: Input with conversation_id.
            db: Optional database session.

        Returns:
            Output with shares list and total count.
        """
        if db is not None:
            return self._process_with_session(input, db)
        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error getting shares for conversation {input.conversation_id}: {e}')
            return GettingConversationShareOutput(
                status=False,
                message=f'Error getting shares: {e}',
            )

    def _process_with_session(
        self, input: GettingConversationShareInput, session,
    ) -> GettingConversationShareOutput:
        """Internal method with provided session."""
        try:
            shares = self.share_controller.get_all(
                session=session,
                filter={'conversation_id': input.conversation_id},
                order_by=None,
                limit=None,
            )

            if not shares:
                logger.info(f'No shares found for conversation: {input.conversation_id}')
                return GettingConversationShareOutput(
                    status=True,
                    message='No shares found',
                    shares=[],
                    total_shares=0,
                )

            logger.info(f'Found {len(shares)} shares for conversation: {input.conversation_id}')

            return GettingConversationShareOutput(
                status=True,
                message=f'Found {len(shares)} shares',
                shares=shares,
                total_shares=len(shares),
            )

        except Exception as e:
            logger.error(f'Error getting shares for conversation {input.conversation_id}: {e}')
            return GettingConversationShareOutput(
                status=False,
                message=f'Error getting shares: {e}',
            )
