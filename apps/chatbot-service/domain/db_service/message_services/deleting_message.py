from __future__ import annotations

import uuid

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import MessageController
from joint.settings.settings import PostgresSettings


logger = get_logger(__name__)


class DeletingMessageInput(BaseModel):
    """
    Input model for deleting messages service.
    Contains user_id to delete all messages for that user.
    """
    user_id: uuid.UUID


class DeletingMessageOutput(BaseModel):
    """
    Output model for deleting message service.
    Contains status and message.
    """
    status: bool
    message: str = ''


class DeletingMessageService(BaseService):
    """Service to handle messages deletion operations - deletes all messages for a user"""

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
    def message_controller(self) -> MessageController:
        """Get message controller instance"""
        return MessageController()

    def process(
        self,
        input: DeletingMessageInput,
        db=None,
    ) -> DeletingMessageOutput:
        """
        Delete all messages for a user

        Args:
            input: DeletingMessageInput with user_id
            db: Optional database session (if None, creates new session)

        Returns:
            DeletingMessageOutput with operation status
        """
        if db is not None:
            # Use provided session (from dependency injection)
            return self._process_with_session(input, db)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return self._process_with_session(input, session)
            except Exception as e:
                logger.error(f"Error deleting messages: {str(e)}")
                return DeletingMessageOutput(
                    status=False,
                    message=f"Failed to delete messages: {str(e)}",
                )

    def _process_with_session(self, input: DeletingMessageInput, db) -> DeletingMessageOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Get all messages for the user first to check if any exist
            user_messages = self.message_controller.get_all(
                db,
                filter={'user_id': input.user_id},
            )

            if not user_messages or len(user_messages) == 0:
                logger.info(f"No messages found for user: {input.user_id}")
                return DeletingMessageOutput(
                    status=True,
                    message='No messages to delete',
                )

            # Delete all messages for the user
            deleted_count = 0
            failed_count = 0

            for message in user_messages:
                try:
                    deleted_message = self.message_controller.delete(
                        db, message.id,
                    )
                    if deleted_message:
                        deleted_count += 1
                    else:
                        failed_count += 1
                        logger.warning(
                            f"Failed to delete message {message.id}",
                        )
                except Exception as e:
                    failed_count += 1
                    logger.error(
                        f"Error deleting message {message.id}: {str(e)}",
                    )

            if failed_count == 0:
                logger.info(
                    f"Successfully deleted all {deleted_count} messages "
                    f"for user {input.user_id}",
                )
                return DeletingMessageOutput(
                    status=True,
                    message=f"Successfully deleted {deleted_count} messages",
                )
            elif deleted_count > 0:
                logger.warning(
                    f"Partially deleted messages for user {input.user_id}: "
                    f"{deleted_count} successful, {failed_count} failed",
                )
                return DeletingMessageOutput(
                    status=True,
                    message=f"Deleted {deleted_count} messages, {failed_count} failed",
                )
            else:
                logger.error(
                    f"Failed to delete any messages for user {input.user_id}",
                )
                return DeletingMessageOutput(
                    status=False,
                    message='Failed to delete any messages',
                )

        except Exception as e:
            logger.error(
                f"Unexpected error deleting messages for user {input.user_id}: {str(e)}",
            )
            return DeletingMessageOutput(
                status=False,
                message=f"Unexpected error occurred: {str(e)}",
            )
