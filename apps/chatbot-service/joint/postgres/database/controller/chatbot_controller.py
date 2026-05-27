from __future__ import annotations

import uuid
from collections.abc import Sequence
from functools import partial
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import Session
from structlog.stdlib import get_logger

from ...models import Chatbot as ChatbotModel
from ...models import ChatbotCollection as ChatbotCollectionModel
from ..repository import Repository
from ..schemas import Chatbot
from ..utils import _delete
from ..utils import _get_data
from ..utils import _get_data_by_id
from ..utils import _insert
from ..utils import _update

logger = get_logger(__name__)

_insert_method = partial(_insert, logger, ChatbotModel, Chatbot)
_update_method = partial(_update, logger, ChatbotModel, Chatbot)
_delete_method = partial(_delete, logger, ChatbotModel, Chatbot)
_get_method = partial(_get_data, logger, ChatbotModel, Chatbot)
_get_by_id_method = partial(_get_data_by_id, logger, ChatbotModel, Chatbot)


class ChatbotController(Repository):
    def insert(self, session: Session, model: Chatbot) -> Chatbot:
        return cast(Chatbot, _insert_method(session, model))

    def update(self, session: Session, model: Chatbot) -> Chatbot | None:
        result = _update_method(session, model)
        return cast(Chatbot, result) if result else None

    def delete(self, session: Session, id: uuid.UUID) -> Chatbot | None:
        result = _delete_method(session, id)
        return cast(Chatbot, result) if result else None

    def get_by_id(self, session: Session, id: uuid.UUID) -> Chatbot | None:
        result = _get_by_id_method(session, id)
        return cast(Chatbot, result) if result else None

    def get_all(
        self,
        session: Session,
        filter: dict[str, object] | None = None,
        order_by: Sequence | None = None,
        limit: int | None = None,
    ) -> list[Chatbot] | None:
        result = _get_method(session, filter, order_by, limit)
        return cast(list[Chatbot], result) if result else None

    def get_by_public_id(
        self, session: Session, public_id: uuid.UUID,
    ) -> Chatbot | None:
        """Lookup a chatbot by its rotatable public_id (for the embed widget)."""
        obj = session.execute(
            select(ChatbotModel).where(ChatbotModel.public_id == public_id),
        ).scalar_one_or_none()
        if not obj:
            return None
        return Chatbot.model_validate(obj)

    # ── Collection bindings ───────────────────────────────────────────
    def replace_collections(
        self,
        session: Session,
        chatbot_id: uuid.UUID,
        collections: list[tuple[uuid.UUID, str]],
    ) -> None:
        """Replace the chatbot's collection bindings atomically.

        ``collections`` is a list of ``(collection_id, collection_name)``.
        """
        session.query(ChatbotCollectionModel).filter(
            ChatbotCollectionModel.chatbot_id == chatbot_id,
        ).delete(synchronize_session=False)
        for cid, cname in collections:
            session.add(
                ChatbotCollectionModel(
                    chatbot_id=chatbot_id,
                    collection_id=cid,
                    collection_name=cname,
                ),
            )
        session.commit()

    def list_collections(
        self, session: Session, chatbot_id: uuid.UUID,
    ) -> list[tuple[uuid.UUID, str]]:
        rows = session.execute(
            select(
                ChatbotCollectionModel.collection_id,
                ChatbotCollectionModel.collection_name,
            ).where(ChatbotCollectionModel.chatbot_id == chatbot_id),
        ).all()
        return [(row[0], row[1]) for row in rows]

    def list_for_user(
        self, session: Session, user_id: uuid.UUID,
    ) -> list[Chatbot]:
        objs = session.execute(
            select(ChatbotModel)
            .where(ChatbotModel.user_id == user_id)
            .order_by(ChatbotModel.updated_at.desc()),
        ).scalars().all()
        return [Chatbot.model_validate(o) for o in objs]

    # ── Widget-active selection (foxai-native) ───────────────────────
    def set_widget_active(
        self,
        session: Session,
        user_id: uuid.UUID,
        chatbot_id: uuid.UUID,
    ) -> Chatbot | None:
        """Atomically mark ``chatbot_id`` as the user's active widget bot.

        Clears the flag on every other chatbot owned by the same user in
        the same transaction, which keeps the partial-unique index happy.
        Returns the newly-active chatbot, or None if it doesn't exist /
        doesn't belong to the user.
        """
        target = session.get(ChatbotModel, chatbot_id)
        if not target or target.user_id != user_id:
            return None

        # Clear flag on every other chatbot of this user first.
        session.query(ChatbotModel).filter(
            ChatbotModel.user_id == user_id,
            ChatbotModel.id != chatbot_id,
            ChatbotModel.is_widget_active.is_(True),
        ).update({'is_widget_active': False}, synchronize_session=False)

        target.is_widget_active = True
        session.add(target)
        session.commit()
        session.refresh(target)
        return Chatbot.model_validate(target)

    def get_widget_active(
        self, session: Session, user_id: uuid.UUID,
    ) -> Chatbot | None:
        """Return the chatbot currently marked as widget-active for the user."""
        obj = session.execute(
            select(ChatbotModel).where(
                ChatbotModel.user_id == user_id,
                ChatbotModel.is_widget_active.is_(True),
            ),
        ).scalar_one_or_none()
        if not obj:
            return None
        return Chatbot.model_validate(obj)
