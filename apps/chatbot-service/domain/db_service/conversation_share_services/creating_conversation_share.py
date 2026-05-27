from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationController
from joint.postgres.database import ConversationShareController
from joint.postgres.database.schemas import ConversationShare
from joint.postgres.database.schemas import SharePermission
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class CreatingConversationShareInput(BaseModel):
    """Input model for creating a conversation share."""
    conversation_id: uuid.UUID
    shared_by_user_id: uuid.UUID
    permission: SharePermission = SharePermission.VIEW
    expires_at: Optional[datetime] = None


class CreatingConversationShareOutput(BaseModel):
    """Output model for creating a conversation share."""
    status: bool
    message: str = ''
    share_id: Optional[uuid.UUID] = None
    share_token: Optional[uuid.UUID] = None


class CreatingConversationShareService(BaseService):
    """Service to create public share links for conversations."""

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

    @property
    def conversation_controller(self) -> ConversationController:
        """Get conversation controller instance."""
        return ConversationController()

    def process(
        self, input: CreatingConversationShareInput, db=None,
    ) -> CreatingConversationShareOutput:
        """Create a public share link for a conversation.

        Args:
            input: Input with conversation and share details.
            db: Optional database session.

        Returns:
            Output with share_id and share_token.
        """
        if db is not None:
            return self._process_with_session(input, db)
        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error sharing conversation {input.conversation_id}: {e}')
            return CreatingConversationShareOutput(
                status=False,
                message=f'Error sharing conversation: {e}',
            )

    def _process_with_session(
        self, input: CreatingConversationShareInput, session,
    ) -> CreatingConversationShareOutput:
        """Internal method with provided session."""
        try:
            # Verify conversation exists and is not deleted
            conversation = self.conversation_controller.get_by_id(
                session, input.conversation_id,
            )
            if not conversation:
                return CreatingConversationShareOutput(
                    status=False,
                    message=f'Conversation not found: {input.conversation_id}',
                )

            if conversation.deleted:
                return CreatingConversationShareOutput(
                    status=False,
                    message='Cannot share a deleted conversation',
                )

            # Verify the user owns the conversation
            if conversation.user_id != input.shared_by_user_id:
                return CreatingConversationShareOutput(
                    status=False,
                    message='You do not have permission to share this conversation',
                )

            # Create share record
            share = ConversationShare(
                conversation_id=input.conversation_id,
                shared_by_user_id=input.shared_by_user_id,
                permission=input.permission,
                is_public=True,
                expires_at=input.expires_at,
            )

            saved_share = self.share_controller.insert(session, share)

            logger.info(
                f'Created public share for conversation {input.conversation_id}: '
                f'token={saved_share.share_token}',
            )

            return CreatingConversationShareOutput(
                status=True,
                message='Conversation shared successfully',
                share_id=saved_share.id,
                share_token=saved_share.share_token,
            )

        except Exception as e:
            logger.error(f'Error sharing conversation {input.conversation_id}: {e}')
            return CreatingConversationShareOutput(
                status=False,
                message=f'Error sharing conversation: {e}',
            )
