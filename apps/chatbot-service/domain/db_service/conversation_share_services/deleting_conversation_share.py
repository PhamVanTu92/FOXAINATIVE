from __future__ import annotations

import uuid

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationShareController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class DeletingConversationShareInput(BaseModel):
    """Input model for revoking a conversation share."""
    share_id: uuid.UUID
    user_id: uuid.UUID


class DeletingConversationShareOutput(BaseModel):
    """Output model for revoking a conversation share."""
    status: bool
    message: str = ''


class DeletingConversationShareService(BaseService):
    """Service to revoke (delete) a conversation share."""

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
        self, input: DeletingConversationShareInput, db=None,
    ) -> DeletingConversationShareOutput:
        """Revoke a conversation share.

        Args:
            input: Input with share_id and user_id for ownership check.
            db: Optional database session.

        Returns:
            Output with status.
        """
        if db is not None:
            return self._process_with_session(input, db)
        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error deleting share {input.share_id}: {e}')
            return DeletingConversationShareOutput(
                status=False,
                message=f'Error deleting share: {e}',
            )

    def _process_with_session(
        self, input: DeletingConversationShareInput, session,
    ) -> DeletingConversationShareOutput:
        """Internal method with provided session."""
        try:
            # Verify share exists and user owns it
            share = self.share_controller.get_by_id(session, input.share_id)
            if not share:
                return DeletingConversationShareOutput(
                    status=False,
                    message=f'Share not found: {input.share_id}',
                )

            if share.shared_by_user_id != input.user_id:
                return DeletingConversationShareOutput(
                    status=False,
                    message='You do not have permission to revoke this share',
                )

            self.share_controller.delete(session, input.share_id)

            logger.info(f'Successfully revoked share: {input.share_id}')

            return DeletingConversationShareOutput(
                status=True,
                message='Share revoked successfully',
            )

        except Exception as e:
            logger.error(f'Error deleting share {input.share_id}: {e}')
            return DeletingConversationShareOutput(
                status=False,
                message=f'Error deleting share: {e}',
            )
