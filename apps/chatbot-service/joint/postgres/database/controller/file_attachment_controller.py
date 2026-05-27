from __future__ import annotations

import uuid
from collections.abc import Sequence
from functools import partial
from typing import cast

from sqlalchemy.orm import Session
from structlog.stdlib import get_logger

from ...models import ConversationFileAttachment as FileAttachmentModel
from ..repository import Repository
from ..schemas import ConversationFileAttachment
from ..utils import _delete
from ..utils import _get_data
from ..utils import _get_data_by_id
from ..utils import _insert
from ..utils import _update

logger = get_logger(__name__)

_insert_method = partial(_insert, logger, FileAttachmentModel, ConversationFileAttachment)
_update_method = partial(_update, logger, FileAttachmentModel, ConversationFileAttachment)
_delete_method = partial(_delete, logger, FileAttachmentModel, ConversationFileAttachment)
_get_method = partial(_get_data, logger, FileAttachmentModel, ConversationFileAttachment)
_get_by_id_method = partial(
    _get_data_by_id, logger,
    FileAttachmentModel, ConversationFileAttachment,
)


class FileAttachmentController(Repository):
    """Controller for conversation file attachment CRUD operations."""

    def insert(self, session: Session, model: ConversationFileAttachment) -> ConversationFileAttachment:
        return cast(ConversationFileAttachment, _insert_method(session, model))

    def update(self, session: Session, model: ConversationFileAttachment) -> ConversationFileAttachment | None:
        result = _update_method(session, model)
        return cast(ConversationFileAttachment, result) if result else None

    def delete(self, session: Session, id: uuid.UUID) -> ConversationFileAttachment | None:
        result = _delete_method(session, id)
        return cast(ConversationFileAttachment, result) if result else None

    def get_by_id(self, session: Session, id: uuid.UUID) -> ConversationFileAttachment | None:
        result = _get_by_id_method(session, id)
        return cast(ConversationFileAttachment, result) if result else None

    def get_all(
        self,
        session: Session,
        filter: dict[str, object] | None = None,
        order_by: Sequence | None = None,
        limit: int | None = None,
    ) -> list[ConversationFileAttachment] | None:
        result = _get_method(session, filter, order_by, limit)
        return cast(list[ConversationFileAttachment], result) if result else None
