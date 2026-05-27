from __future__ import annotations

import uuid
from abc import ABC
from abc import abstractmethod
from collections.abc import Sequence
from typing import TypeVar
from typing import Union

from sqlalchemy.orm import Session

from .schemas import Chunk
from .schemas import Collection
from .schemas import Document

# Type variables for generic methods
T = TypeVar(
    'T', Chunk, Collection, Document,
)


class Repository(ABC):
    @abstractmethod
    def insert(
        self,
        session: Session,
        model: Union[
            Chunk, Collection, Document,
        ],
    ) -> Union[
        Chunk, Collection, Document,
    ] | None:
        raise NotImplementedError()

    @abstractmethod
    def update(
        self,
        session: Session,
        model: Union[
            Chunk, Collection, Document,
        ],
    ) -> Union[
        Chunk, Collection, Document,
    ] | None:
        raise NotImplementedError()

    @abstractmethod
    def delete(
        self,
        session: Session,
        id: uuid.UUID,
    ) -> Union[
        Chunk, Collection, Document,
    ] | None:
        raise NotImplementedError()

    @abstractmethod
    def get_by_id(
        self,
        session: Session,
        id: uuid.UUID,
    ) -> Union[
        Chunk, Collection, Document,
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
            Chunk, Collection, Document,
        ]
    ] | None:
        raise NotImplementedError()

