"""Collection description service — fetches description via Index service internal API.

Calls the Index service's internal endpoint to retrieve the collection description
for injection into agent system prompts, using httpx over Docker internal network (no auth).
"""
from __future__ import annotations

from typing import Optional

import httpx
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings
from pydantic import Field

logger = get_logger(__name__)

# httpx client timeout (seconds)
_REQUEST_TIMEOUT = 10.0


class CollectionDescriptionOutput(BaseModel):
    """Output model for CollectionDescriptionService."""

    description: Optional[str] = Field(
        None, description='Collection description text',
    )
    collection_name: str = Field(
        default='', description='Collection name',
    )
    status: bool = Field(default=True, description='Success status')
    message: Optional[str] = Field(None, description='Error message if any')


class CollectionDescriptionService(BaseService):
    """Service for fetching collection description from the Index service internal API.

    Communicates with the Index service at ``settings.index_service_url``
    over Docker internal network without authentication.

    Attributes:
        settings: Application settings containing ``index_service_url``.
        collection_name: Target collection name for description lookup.
    """

    settings: Settings
    collection_name: str

    async def process(self) -> CollectionDescriptionOutput:
        """Fetch collection description from Index service internal API.

        Calls ``GET /v1/internal/collections/{collection_name}/description``
        and returns the description string.

        Returns:
            CollectionDescriptionOutput with description and status.
        """
        base_url = self.settings.index_service_url.rstrip('/')
        url = (
            f"{base_url}/v1/internal/collections/"
            f"{self.collection_name}/description"
        )

        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
                response = await client.get(url)
                response.raise_for_status()

            data = response.json()

            # Extract from handle_success wrapper: {"message": "...", "info": {...}}
            info = data.get('info', data)
            description = info.get('description')
            collection_name = info.get(
                'collection_name', self.collection_name,
            )

            logger.info(
                f"Retrieved description for collection "
                f"'{collection_name}'",
            )

            return CollectionDescriptionOutput(
                description=description,
                collection_name=collection_name,
                status=True,
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Index API error ({e.response.status_code}): "
                f"{e.response.text}",
            )
            return CollectionDescriptionOutput(
                collection_name=self.collection_name,
                status=False,
                message=f'Index API error: {e.response.status_code}',
            )
        except httpx.RequestError as e:
            logger.error(f"Index API connection error: {e}")
            return CollectionDescriptionOutput(
                collection_name=self.collection_name,
                status=False,
                message=f'Index API connection error: {e}',
            )
        except Exception as e:
            logger.error(
                f"Unexpected error fetching collection description: {e}",
            )
            return CollectionDescriptionOutput(
                collection_name=self.collection_name,
                status=False,
                message=f'Unexpected error: {e}',
            )
