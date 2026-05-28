from __future__ import annotations

import uuid

from domain.db_service.conversation_services import DeletingConversationInput
from domain.db_service.conversation_services import DeletingConversationOutput as DomainDeletingConversationOutput
from domain.db_service.conversation_services import DeletingConversationService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings


logger = get_logger(__name__)


class ConversationDeletingInput(BaseModel):
    """Input model for deleting conversation"""
    conversation_id: uuid.UUID
    hard_delete: bool = False


class ConversationDeletingOutput(BaseModel):
    """Output model for deleting conversation"""
    success: bool
    message: str = ''


class ConversationDeletingService(BaseService):
    """App service for deleting conversations"""

    postgres_settings: PostgresSettings

    async def process(self, inputs: ConversationDeletingInput, db_session=None) -> ConversationDeletingOutput:
        """
        Process conversation deletion request

        Args:
            inputs: ConversationDeletingInput with conversation_id
            db_session: Optional database session

        Returns:
            ConversationDeletingOutput with status
        """
        try:
            logger.info(
                f"Deleting conversation: {inputs.conversation_id}, hard_delete: {inputs.hard_delete}",
            )

            # Create domain service input
            domain_input = DeletingConversationInput(
                conversation_id=inputs.conversation_id,
                hard_delete=inputs.hard_delete,
            )

            # Initialize and run domain service
            domain_service = DeletingConversationService(
                settings=self.postgres_settings,
            )
            result: DomainDeletingConversationOutput = domain_service.process(
                domain_input, db_session,
            )

            if result.status:
                # Clear conversation memory when conversation is deleted
                try:
                    from domain.orchestrator.graphs.agentic_graph.graph import AgenticService
                    AgenticService.clear_conversation_memory(
                        str(inputs.conversation_id),
                    )
                    logger.info(
                        f"Cleared memory for deleted conversation: {inputs.conversation_id}",
                    )
                except Exception as memory_error:
                    # Don't fail the delete operation if memory cleanup fails
                    logger.warning(
                        f"Failed to clear memory for conversation {inputs.conversation_id}: {memory_error}",
                    )

                logger.info(
                    f"Successfully deleted conversation: {inputs.conversation_id}",
                )
                return ConversationDeletingOutput(
                    success=True,
                    message=result.message,
                )
            else:
                logger.warning(
                    f"Failed to delete conversation: {result.message}",
                )
                return ConversationDeletingOutput(
                    success=False,
                    message=result.message,
                )

        except Exception as e:
            error_msg = f"Unexpected error deleting conversation: {str(e)}"
            logger.error(error_msg)
            return ConversationDeletingOutput(
                success=False,
                message=error_msg,
            )
