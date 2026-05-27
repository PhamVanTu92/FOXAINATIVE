from __future__ import annotations

import uuid
from typing import List

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import FileAttachmentController
from joint.postgres.database.schemas import ConversationFileAttachment
from joint.settings.settings import PostgresSettings
from sqlalchemy import update

logger = get_logger(__name__)


class UpdatingFileAttachmentMessageInput(BaseModel):
    """Input model for linking file attachments to a message."""
    file_ids: List[uuid.UUID]
    message_id: uuid.UUID


class UpdatingFileAttachmentMessageOutput(BaseModel):
    """Output model for updating file attachment message_id."""
    status: bool
    message: str = ''
    updated_count: int = 0


class UpdatingFileAttachmentMessageService(BaseService):
    """Service to link file attachments to a message after streaming completes."""

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
        self, input: UpdatingFileAttachmentMessageInput, db=None,
    ) -> UpdatingFileAttachmentMessageOutput:
        """Update message_id for file attachments (batch update).

        Args:
            input: Input with file_ids and target message_id.
            db: Optional database session.

        Returns:
            Output with update count.
        """
        if db is not None:
            return self._process_with_session(input, db)
        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error updating file attachment message_id: {e}')
            return UpdatingFileAttachmentMessageOutput(
                status=False,
                message=f'Error updating file attachments: {e}',
            )

    def _process_with_session(
        self, input: UpdatingFileAttachmentMessageInput, db,
    ) -> UpdatingFileAttachmentMessageOutput:
        """Internal method with provided session."""
        try:
            from joint.postgres.models import ConversationFileAttachment as FileAttachmentModel

            stmt = (
                update(FileAttachmentModel)
                .where(FileAttachmentModel.id.in_(input.file_ids))
                .values(message_id=input.message_id)
            )
            result = db.execute(stmt)
            db.commit()

            updated_count = result.rowcount
            logger.info(
                f'Linked {updated_count} file attachments to message: {input.message_id}',
            )

            return UpdatingFileAttachmentMessageOutput(
                status=True,
                message=f'Updated {updated_count} file attachments',
                updated_count=updated_count,
            )

        except Exception as e:
            logger.error(f'Error updating file attachment message_id: {e}', exc_info=True)
            return UpdatingFileAttachmentMessageOutput(
                status=False,
                message=f'Error updating file attachments: {e}',
            )
