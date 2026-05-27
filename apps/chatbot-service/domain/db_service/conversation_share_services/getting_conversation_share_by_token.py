from __future__ import annotations

import uuid
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationShareController
from joint.postgres.database.schemas import ConversationShare
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GettingConversationShareByTokenInput(BaseModel):
    """Input model for getting a conversation share by token."""
    share_token: uuid.UUID


class GettingConversationShareByTokenOutput(BaseModel):
    """Output model for getting a conversation share by token."""
    status: bool
    message: str = ''
    share: Optional[ConversationShare] = None


class GettingConversationShareByTokenService(BaseService):
    """Service to get a conversation share by its public token.

    Used for public access to shared conversations (no auth required).
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

    @property
    def share_controller(self) -> ConversationShareController:
        """Get conversation share controller instance."""
        return ConversationShareController()

    def process(
        self, input: GettingConversationShareByTokenInput, db=None,
    ) -> GettingConversationShareByTokenOutput:
        """Get a conversation share by its public token.

        Args:
            input: Input with share_token.
            db: Optional database session.

        Returns:
            Output with share details.
        """
        if db is not None:
            return self._process_with_session(input, db)
        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error getting share by token: {e}')
            return GettingConversationShareByTokenOutput(
                status=False,
                message=f'Error retrieving share: {e}',
            )

    def _process_with_session(
        self, input: GettingConversationShareByTokenInput, session,
    ) -> GettingConversationShareByTokenOutput:
        """Internal method with provided session."""
        try:
            share = self.share_controller.get_by_token(
                session=session,
                share_token=input.share_token,
            )

            if not share:
                logger.warning(f'Share not found for token: {input.share_token}')
                return GettingConversationShareByTokenOutput(
                    status=False,
                    message='Share not found or has been revoked',
                )

            logger.info(
                f'Retrieved share {share.id} for conversation {share.conversation_id}',
            )

            return GettingConversationShareByTokenOutput(
                status=True,
                message='Share retrieved successfully',
                share=share,
            )

        except Exception as e:
            logger.error(f'Error getting share by token: {e}', exc_info=True)
            return GettingConversationShareByTokenOutput(
                status=False,
                message=f'Error retrieving share: {e}',
            )
