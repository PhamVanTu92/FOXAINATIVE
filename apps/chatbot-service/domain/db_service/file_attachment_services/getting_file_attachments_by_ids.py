from __future__ import annotations

import uuid
from typing import List
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import FileAttachmentController
from joint.postgres.database.schemas import ConversationFileAttachment
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GettingFileAttachmentsByIdsInput(BaseModel):
    """Input model for getting file attachments by a list of IDs."""
    file_ids: List[uuid.UUID]


class GettingFileAttachmentsByIdsOutput(BaseModel):
    """Output model for getting file attachments by IDs."""
    status: bool
    message: str = ''
    attachments: List[ConversationFileAttachment] = []


class GettingFileAttachmentsByIdsService(BaseService):
    """Service to retrieve file attachments by their IDs."""

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
    def file_attachment_controller(self) -> FileAttachmentController:
        """Get file attachment controller instance."""
        return FileAttachmentController()

    def process(
        self, input: GettingFileAttachmentsByIdsInput, db=None,
    ) -> GettingFileAttachmentsByIdsOutput:
        """Get file attachments by their IDs.

        Args:
            input: Input with list of file IDs.
            db: Optional database session.

        Returns:
            Output with list of file attachment records.
        """
        if db is not None:
            return self._process_with_session(input, db)
        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error getting file attachments: {e}')
            return GettingFileAttachmentsByIdsOutput(
                status=False,
                message=f'Error getting file attachments: {e}',
            )

    def _process_with_session(
        self, input: GettingFileAttachmentsByIdsInput, db,
    ) -> GettingFileAttachmentsByIdsOutput:
        """Internal method with provided session."""
        try:
            attachments: List[ConversationFileAttachment] = []
            for file_id in input.file_ids:
                attachment = self.file_attachment_controller.get_by_id(db, file_id)
                if attachment:
                    attachments.append(attachment)

            logger.info(f'Retrieved {len(attachments)} / {len(input.file_ids)} file attachments')

            return GettingFileAttachmentsByIdsOutput(
                status=True,
                message=f'Retrieved {len(attachments)} file attachments',
                attachments=attachments,
            )

        except Exception as e:
            logger.error(f'Error getting file attachments: {e}', exc_info=True)
            return GettingFileAttachmentsByIdsOutput(
                status=False,
                message=f'Error getting file attachments: {e}',
            )
