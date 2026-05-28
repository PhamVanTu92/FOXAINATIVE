from __future__ import annotations

import uuid
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


class CreatingFileAttachmentInput(BaseModel):
    """Input model for creating a file attachment record."""
    user_id: uuid.UUID
    conversation_id: Optional[uuid.UUID] = None
    file_name: str
    file_type: str
    file_size: Optional[int] = None
    storage_path: str
    extracted_content: Optional[str] = None
    processing_status: str = 'success'
    error_message: Optional[str] = None


class CreatingFileAttachmentOutput(BaseModel):
    """Output model for creating a file attachment record."""
    status: bool
    message: str = ''
    attachment_id: Optional[uuid.UUID] = None


class CreatingFileAttachmentService(BaseService):
    """Service to create file attachment records in the database."""

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

    def process(self, input: CreatingFileAttachmentInput, db=None) -> CreatingFileAttachmentOutput:
        """Create a file attachment record in the database.

        Args:
            input: CreatingFileAttachmentInput with file details.
            db: Optional database session.

        Returns:
            CreatingFileAttachmentOutput with attachment_id.
        """
        if db is not None:
            return self._process_with_session(input, db)
        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error creating file attachment: {e}')
            return CreatingFileAttachmentOutput(
                status=False,
                message=f'Error creating file attachment: {e}',
            )

    def _process_with_session(
        self, input: CreatingFileAttachmentInput, session,
    ) -> CreatingFileAttachmentOutput:
        """Internal method with provided session."""
        try:
            attachment = ConversationFileAttachment(
                user_id=input.user_id,
                conversation_id=input.conversation_id,
                file_name=input.file_name,
                file_type=input.file_type,
                file_size=input.file_size,
                storage_path=input.storage_path,
                extracted_content=input.extracted_content,
                processing_status=input.processing_status,
                error_message=input.error_message,
            )

            saved = self.file_attachment_controller.insert(session, attachment)

            logger.info(
                f'Created file attachment: {saved.id} for conversation: {input.conversation_id}',
            )

            return CreatingFileAttachmentOutput(
                status=True,
                message='File attachment created successfully',
                attachment_id=saved.id,
            )

        except Exception as e:
            logger.error(f'Error creating file attachment: {e}')
            return CreatingFileAttachmentOutput(
                status=False,
                message=f'Error creating file attachment: {e}',
            )
