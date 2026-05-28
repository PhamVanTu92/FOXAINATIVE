from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session
from structlog.stdlib import BoundLogger

from ..models import Base
from .schemas import DatabaseSchema


def _insert(
    logger: BoundLogger,
    model_cls: type[Base],
    schema_cls: type[DatabaseSchema],
    session: Session,
    data: DatabaseSchema,
) -> DatabaseSchema:
    """Insert arbitrary data model

    Args:
        logger (BoundLogger): logger
        session (Session): database session
        model_cls (Type[Base]): data model type
        schema_cls (Type[DatabaseSchema]): data schema type
        data (DatabaseSchema): data

    Returns:
        DatabaseSchema: inserted data
    """
    try:
        obj = model_cls(**data.model_dump(exclude_none=True))
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return schema_cls.model_validate(obj)
    except Exception as e:
        logger.exception(f'Error inserting {schema_cls}: {e}', channel=data)
        raise e


def _update(
    logger: BoundLogger,
    model_cls: type[Base],
    schema_cls: type[DatabaseSchema],
    session: Session,
    data: DatabaseSchema,
) -> DatabaseSchema | None:
    """Update arbitrary data model

    Args:
        logger (BoundLogger): logger
        session (Session): database session
        model_cls (Type[Base]): data model type
        schema_cls (Type[DatabaseSchema]): data schema type
        data (DatabaseSchema): data

    Returns:
        DatabaseSchema | None: updated data or None if no data updated
    """
    try:
        obj = session.get(model_cls, data.id)
        if obj:
            for k, v in vars(data).items():
                if v is not None:
                    setattr(obj, k, v)

            session.add(obj)
            session.commit()
            session.refresh(obj)
            return schema_cls.model_validate(obj)
        else:
            logger.info(f'No {schema_cls} found with id: {data.id}')
            return None
    except Exception as e:
        logger.exception(f'Error updating {schema_cls}: {e}', channel=data)
        raise e


def _get_data(
    logger: BoundLogger,
    model_cls: type[Base],
    schema_cls: type[DatabaseSchema],
    session: Session,
    filter: dict[str, object] | None = None,
    order_by: Sequence | None = None,
    limit: int | None = None,
) -> list[DatabaseSchema] | None:
    """Get arbitrary data with filter

    Args:
        logger (BoundLogger): logger
        session (Session): database session
        model_cls (Type[Base]): data model type
        schema_cls (Type[DatabaseSchema]): data schema type
        filter (dict[str, object] | None, optional): filter. Defaults to None.
        limit (int | None, optional): limit. Defaults to None.

    Returns:
        list[DatabaseSchema] | None: list of data returned or None if no data returned
    """
    try:
        statement = select(model_cls)
        if filter:
            statement = statement.filter_by(**filter)
        if order_by:
            statement = statement.order_by(*order_by)
        if limit:
            statement = statement.limit(limit)
        objs = session.scalars(statement=statement).all()
        if len(objs) == 0:
            return None
        return [schema_cls.model_validate(obj) for obj in objs]
    except Exception as e:
        logger.exception(
            f'Error fetching {schema_cls}: {e}',
            filter=filter,
            limit=limit,
        )
        raise e


def _get_data_by_id(
    logger: BoundLogger,
    model_cls: type[Base],
    schema_cls: type[DatabaseSchema],
    session: Session,
    id: uuid.UUID,
) -> DatabaseSchema | None:
    """Get arbitrary data by id

    Args:
        logger (BoundLogger): logger
        session (Session): database session
        model_cls (Type[Base]): data model type
        schema_cls (Type[DatabaseSchema]): data schema type
        id (uuid.UUID): id

    Returns:
        DatabaseSchema: Returned data
    """
    try:
        obj = session.get(model_cls, id)
        if not obj:
            return None
        return schema_cls.model_validate(obj)
    except Exception as e:
        logger.exception(f'Error fetching {schema_cls}: {e}', id=id)
        raise e


def _delete(
    logger: BoundLogger,
    model_cls: type[Base],
    schema_cls: type[DatabaseSchema],
    session: Session,
    id: uuid.UUID,
) -> DatabaseSchema | None:
    """Delete arbitrary data by id

    Args:
        logger (BoundLogger): logger
        session (Session): database session
        model_cls (Type[Base]): data model type
        schema_cls (Type[DatabaseSchema]): data schema type
        id (uuid.UUID): id

    Returns:
        DatabaseSchema: Deleted data or None if no delete
    """
    try:
        obj = session.get(model_cls, id)
        if obj:
            session.delete(obj)
            session.commit()
            return schema_cls.model_validate(obj)
        else:
            logger.info(f'No {schema_cls} found with id: {id}')
            return None
    except Exception as e:
        logger.exception(f'Error deleting {schema_cls}: {e}', id=id)
        raise e
