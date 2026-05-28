"""PostgreSQL database configuration models for Query Service."""
from __future__ import annotations

import os
from typing import Optional

from joint.base import BaseModel
from pydantic import Field
from pydantic import field_validator


class PostgresSettings(BaseModel):
    """PostgreSQL database connection settings.

    Supports flexible environment variable loading:
    - POSTGRES__USERNAME, POSTGRES__PASSWORD, POSTGRES__PORT, POSTGRES__LIMIT: Shared config
    - POSTGRES__HOST: Service-specific host (POSTGRES__QUERY_HOST or POSTGRES__HOST)
    - POSTGRES__DB: Service-specific database (POSTGRES__QUERY_DB or POSTGRES__DB)
    """

    username: str = Field(
        ...,
        description='PostgreSQL username for authentication.',
    )
    password: str = Field(
        ...,
        description='PostgreSQL password for authentication.',
    )
    host: str = Field(
        ...,
        description='PostgreSQL host address (container name or IP).',
    )
    db: str = Field(
        ...,
        description='PostgreSQL database name.',
    )
    port: int = Field(
        default=5432,
        description='PostgreSQL connection port.',
    )
    limit: int = Field(
        default=50,
        description='Default query result limit.',
    )
    pool_size: int = Field(
        default=10,
        description='Base number of persistent connections per worker process.',
    )
    max_overflow: int = Field(
        default=10,
        description='Extra temporary connections allowed above pool_size.',
    )
    pool_timeout: int = Field(
        default=30,
        description='Seconds to wait for a connection before raising an error.',
    )
    pool_recycle: int = Field(
        default=1800,
        description='Seconds after which a connection is recycled (prevents stale).',
    )

    @field_validator('host', mode='before')
    @classmethod
    def resolve_host(cls, v: Optional[str]) -> str:
        """Resolve host from service-specific or shared environment variables.

        Priority: POSTGRES__QUERY_HOST > POSTGRES__HOST > provided value
        """
        if v is None:
            host = os.getenv('POSTGRES__QUERY_HOST') or os.getenv(
                'POSTGRES__HOST',
            ) or 'localhost'
            return str(host)
        return str(v)

    @field_validator('db', mode='before')
    @classmethod
    def resolve_db(cls, v: Optional[str]) -> str:
        """Resolve database name from service-specific or shared environment variables.

        Priority: POSTGRES__QUERY_DB > POSTGRES__DB > provided value
        """
        if v is None:
            db = os.getenv('POSTGRES__QUERY_DB') or os.getenv(
                'POSTGRES__DB',
            ) or 'query_db'
            return str(db)
        return str(v)
