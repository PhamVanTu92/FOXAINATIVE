from __future__ import annotations

import uuid
from abc import ABC
from abc import abstractmethod
from collections.abc import Sequence
from typing import TypeVar
from typing import Union

from sqlalchemy.orm import Session

from .schemas import Conversation
from .schemas import ConversationFileAttachment
from .schemas import ConversationShare
from .schemas import Message

# Type variables for generic methods
T = TypeVar(
    'T', Message, Conversation, ConversationFileAttachment, ConversationShare,
)


class Repository(ABC):
    @abstractmethod
    def insert(
        self,
        session: Session,
        model: Union[
            Message, Conversation, ConversationFileAttachment, ConversationShare,
        ],
    ) -> Union[
        Message, Conversation, ConversationFileAttachment, ConversationShare,
    ] | None:
        raise NotImplementedError()

    @abstractmethod
    def update(
        self,
        session: Session,
        model: Union[
            Message, Conversation, ConversationFileAttachment, ConversationShare,
        ],
    ) -> Union[
        Message, Conversation, ConversationFileAttachment, ConversationShare,
    ] | None:
        raise NotImplementedError()

    @abstractmethod
    def delete(
        self,
        session: Session,
        id: uuid.UUID,
    ) -> Union[
        Message, Conversation, ConversationFileAttachment, ConversationShare,
    ] | None:
        raise NotImplementedError()

    @abstractmethod
    def get_by_id(
        self,
        session: Session,
        id: uuid.UUID,
    ) -> Union[
        Message, Conversation, ConversationFileAttachment, ConversationShare,
    ] | None:
        raise NotImplementedError()

    @abstractmethod
    def get_all(
        self,
        session: Session,
        filter: dict[str, object] | None = None,
        order_by: Sequence | None = None,
        limit: int | None = None,
    ) -> list[
        Union[
            Message, Conversation, ConversationFileAttachment, ConversationShare,
        ]
    ] | None:
        raise NotImplementedError()
