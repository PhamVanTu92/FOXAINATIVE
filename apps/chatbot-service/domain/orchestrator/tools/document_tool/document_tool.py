"""Document tool service — lists documents via Index service internal API.

Calls the Index service's internal endpoint to retrieve document names
for a given collection, using httpx over Docker internal network (no auth).
"""
from __future__ import annotations

from typing import List
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


class DocumentToolOutput(BaseModel):
    """Output model for DocumentToolService."""

    document_names: List[str] = Field(
        default_factory=list,
        description='List of document display names',
    )
    total: int = Field(default=0, description='Total number of documents')
    status: bool = Field(default=True, description='Success status')
    message: Optional[str] = Field(None, description='Error message if any')


class DocumentToolService(BaseService):
    """Service for listing documents from the Index service internal API.

    Communicates with the Index service at ``settings.index_service_url``
    over Docker internal network without authentication.

    Attributes:
        settings: Application settings containing ``index_service_url``.
        collection_name: Target collection name for document lookup.
    """

    settings: Settings
    collection_name: str

    async def process(self) -> DocumentToolOutput:
        """Fetch document names from Index service internal API.

        Calls ``GET /v1/internal/collections/{collection_name}/document-names``
        and returns the list of document display names.

        Returns:
            DocumentToolOutput with document names and count.
        """
        base_url = self.settings.index_service_url.rstrip('/')
        url = (
            f"{base_url}/v1/internal/collections/"
            f"{self.collection_name}/document-names"
        )

        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
                response = await client.get(url)
                response.raise_for_status()

            data = response.json()

            # Extract from handle_success wrapper: {"message": "...", "info": {...}}
            info = data.get('info', data)
            document_names = info.get('document_names', [])
            total = info.get('total', len(document_names))

            logger.info(
                f"Retrieved {total} documents from collection "
                f"'{self.collection_name}'",
            )

            return DocumentToolOutput(
                document_names=document_names,
                total=total,
                status=True,
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Index API error ({e.response.status_code}): "
                f"{e.response.text}",
            )
            return DocumentToolOutput(
                status=False,
                message=f'Index API error: {e.response.status_code}',
            )
        except httpx.RequestError as e:
            logger.error(f"Index API connection error: {e}")
            return DocumentToolOutput(
                status=False,
                message=f'Index API connection error: {e}',
            )
        except Exception as e:
            logger.error(f"Unexpected error fetching documents: {e}")
            return DocumentToolOutput(
                status=False,
                message=f'Unexpected error: {e}',
            )
