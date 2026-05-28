from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from pydantic import Field


class QdrantSettings(BaseModel):
    host: str = Field(
        ...,
        description='Qdrant host URL.',
    )
    api_key: Optional[str] = Field(
        '',
        description='API key for Qdrant. Optional for local development.',
    )
    collection_name: str = Field(
        ...,
        description='Qdrant collection name.',
    )
