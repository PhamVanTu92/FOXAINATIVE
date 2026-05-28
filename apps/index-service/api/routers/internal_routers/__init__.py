# Internal routers for service-to-service communication
from __future__ import annotations

from . import get_collection_description
from . import get_document_names

__all__ = [
    'get_document_names',
    'get_collection_description',
]
