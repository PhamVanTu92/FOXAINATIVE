from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class RedisSettings(BaseModel):
    """Redis cache configuration settings."""

    host: str = Field(
        'redis',
        description='Redis server host.',
    )
    port: int = Field(
        6379,
        description='Redis server port.',
    )
    password: str = Field(
        '',
        description='Redis password (empty if no auth).',
    )
    database: int = Field(
        0,
        description='Redis database number.',
    )
    ssl: bool = Field(
        False,
        description='Enable SSL for Redis connection.',
    )
    connection_timeout: float = Field(
        10.0,
        description='Redis connection timeout in seconds.',
    )
    socket_timeout: float = Field(
        5.0,
        description='Redis socket timeout in seconds.',
    )
    max_connections: int = Field(
        20,
        description='Maximum number of connections in Redis pool.',
    )
    retry_on_timeout: bool = Field(
        True,
        description='Retry on timeout.',
    )
    decode_responses: bool = Field(
        True,
        description='Decode Redis responses to strings.',
    )
    ttl_seconds: int = Field(
        900,  # 15 minutes default
        description='Default TTL for cached data in seconds.',
    )

    @property
    def connection_url(self) -> str:
        """Generate Redis connection URL."""
        scheme = 'rediss' if self.ssl else 'redis'
        auth_part = f":{self.password}@" if self.password else ''
        return f"{scheme}://{auth_part}{self.host}:{self.port}/{self.database}"
