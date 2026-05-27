from __future__ import annotations

import uuid
from collections.abc import Sequence
from functools import partial
from typing import Optional
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import Session
from structlog.stdlib import get_logger

from ...models import ConversationShare as ConversationShareModel
from ..repository import Repository
from ..schemas import ConversationShare
from ..utils import _delete
from ..utils import _get_data
from ..utils import _get_data_by_id
from ..utils import _insert
from ..utils import _update

logger = get_logger(__name__)

_insert_method = partial(_insert, logger, ConversationShareModel, ConversationShare)
_update_method = partial(_update, logger, ConversationShareModel, ConversationShare)
_delete_method = partial(_delete, logger, ConversationShareModel, ConversationShare)
_get_method = partial(_get_data, logger, ConversationShareModel, ConversationShare)
_get_by_id_method = partial(
    _get_data_by_id, logger,
    ConversationShareModel, ConversationShare,
)


class ConversationShareController(Repository):
    """Controller for conversation share CRUD operations."""

    def insert(self, session: Session, model: ConversationShare) -> ConversationShare:
        return cast(ConversationShare, _insert_method(session, model))

    def update(self, session: Session, model: ConversationShare) -> ConversationShare | None:
        result = _update_method(session, model)
        return cast(ConversationShare, result) if result else None

    def delete(self, session: Session, id: uuid.UUID) -> ConversationShare | None:
        result = _delete_method(session, id)
        return cast(ConversationShare, result) if result else None

    def get_by_id(self, session: Session, id: uuid.UUID) -> ConversationShare | None:
        result = _get_by_id_method(session, id)
        return cast(ConversationShare, result) if result else None

    def get_all(
        self,
        session: Session,
        filter: dict[str, object] | None = None,
        order_by: Sequence | None = None,
        limit: int | None = None,
    ) -> list[ConversationShare] | None:
        result = _get_method(session, filter, order_by, limit)
        return cast(list[ConversationShare], result) if result else None

    def get_by_token(self, session: Session, share_token: uuid.UUID) -> Optional[ConversationShare]:
        """Get a conversation share by its public share token.

        Args:
            session: Database session.
            share_token: Public share token UUID.

        Returns:
            ConversationShare if found, None otherwise.
        """
        try:
            stmt = select(ConversationShareModel).filter_by(share_token=share_token)
            obj = session.execute(stmt).scalar_one_or_none()
            if not obj:
                return None
            return ConversationShare.model_validate(obj)
        except Exception as e:
            logger.exception(f'Error fetching share by token: {e}', share_token=str(share_token))
            raise e
