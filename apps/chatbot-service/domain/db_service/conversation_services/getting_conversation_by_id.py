from __future__ import annotations

import uuid
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationController
from joint.postgres.database.schemas import Conversation
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GettingConversationByIdInput(BaseModel):
    """Input model for getting conversation by ID"""
    conversation_id: uuid.UUID


class GettingConversationByIdOutput(BaseModel):
    """Output model for getting conversation by ID"""
    status: bool
    message: str = ''
    conversation: Optional[Conversation] = None


class GettingConversationByIdService(BaseService):
    """Service to get a single conversation by ID"""

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
    def conversation_controller(self) -> ConversationController:
        """Get conversation controller instance"""
        return ConversationController()

    def process(
        self,
        input: GettingConversationByIdInput,
        session=None,
    ) -> GettingConversationByIdOutput:
        """
        Get conversation by ID.

        Args:
            input: Input containing conversation_id
            session: Optional database session

        Returns:
            Output with status, message and conversation object
        """
        if session is not None:
            return self._process_with_session(input, session)
        else:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)

    def _process_with_session(
        self,
        input: GettingConversationByIdInput,
        session,
    ) -> GettingConversationByIdOutput:
        """Internal method with session"""
        try:
            logger.info(f'Getting conversation by ID: {input.conversation_id}')

            # Get conversation by ID
            conversation = self.conversation_controller.get_by_id(
                session=session,
                id=input.conversation_id,
            )

            if not conversation:
                logger.warning(
                    f'Conversation not found: {input.conversation_id}',
                )
                return GettingConversationByIdOutput(
                    status=False,
                    message='Conversation not found',
                )

            # Check if deleted
            if conversation.deleted:
                logger.warning(
                    f'Conversation is deleted: {input.conversation_id}',
                )
                return GettingConversationByIdOutput(
                    status=False,
                    message='Conversation has been deleted',
                )

            logger.info(
                f'Successfully retrieved conversation: {conversation.id}',
            )

            return GettingConversationByIdOutput(
                status=True,
                message='Conversation retrieved successfully',
                conversation=conversation,
            )

        except Exception as e:
            logger.error(
                f'Error getting conversation by ID: {str(e)}', exc_info=True,
            )
            return GettingConversationByIdOutput(
                status=False,
                message=f'Error retrieving conversation: {str(e)}',
            )
