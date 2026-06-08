from __future__ import annotations

import re
import unicodedata
from uuid import UUID

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from app.colllections.update_collection import CollectionUpdateInput
from app.colllections.update_collection import CollectionUpdateOutput
from app.colllections.update_collection import CollectionUpdateService
from app.colllections.update_collection import UpdateCollectionRequest
from fastapi import APIRouter
from fastapi import Depends
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()


@router.put(
    '/collections/{collection_id}',
    response_model=CollectionUpdateOutput,
    summary='Update a collection',
    description="""Update a collection's name and/or description.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Request Body (all fields optional — only the provided ones change):
```json
{
  "collection_name": "Tri thức ngân hàng",
  "description": "Tài liệu CSKH ngân hàng"
}
```

Validation Rules:
- collection_name: letters (including Vietnamese with diacritics), numbers,
  spaces, underscore and hyphen — e.g. "Tri thức nội bộ". Must be unique.

Business Rules:
- Renaming also migrates the underlying Qdrant collection (clone → commit →
  drop old) so no vectors are lost.
- WARNING: chatbots already bound to the OLD name must re-select this
  collection after a rename (the binding lives in the chatbot service).

Common Errors:
- 400: Invalid name format / duplicate name / nothing to update
- 403: Caller does not own the collection
- 404: Collection not found""",
)
async def update_collection(
    collection_id: UUID,
    request: UpdateCollectionRequest,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> CollectionUpdateOutput:
    """Update collection metadata, renaming the Qdrant collection if needed."""
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    base_extra = {
        'endpoint': 'update_collection',
        'collection_id': str(collection_id),
        'user_id': str(current_user.user_id),
    }

    # Nothing provided → nothing to do.
    if (
        request.collection_name is None
        and request.description is None
        and request.collection_style is None
    ):
        return exception_handler.handle_bad_request(
            message='No fields provided to update',
            extra=base_extra,
        )

    # Normalize + validate the new name (same rules as collection creation).
    normalized_name = None
    if request.collection_name is not None:
        normalized_name = unicodedata.normalize(
            'NFC', request.collection_name,
        ).strip()
        if not normalized_name:
            return exception_handler.handle_bad_request(
                message='Collection name cannot be empty',
                extra=base_extra,
            )
        if not re.match(r'^[\w -]+$', normalized_name, re.UNICODE):
            return exception_handler.handle_bad_request(
                message=(
                    'Collection name can only contain letters (including '
                    'Vietnamese), numbers, spaces, underscore, and hyphen'
                ),
                extra=base_extra,
            )

    try:
        service = CollectionUpdateService(settings=settings)
        result = await service.process(
            CollectionUpdateInput(
                collection_id=collection_id,
                user_id=current_user.user_id,
                collection_name=normalized_name,
                description=request.description,
                collection_style=request.collection_style,
            ),
            db=db,
        )
        logger.info(f'Collection update completed for: {collection_id}')
        return exception_handler.handle_success(output=result.model_dump())

    except PermissionError as e:
        return exception_handler.handle_forbidden(
            message=str(e), extra=base_extra,
        )
    except ValueError as e:
        error_msg = str(e).lower()
        if 'not found' in error_msg:
            return exception_handler.handle_not_found_error(
                message=str(e), extra=base_extra,
            )
        return exception_handler.handle_bad_request(
            message=str(e), extra={**base_extra, 'error': str(e)},
        )
    except Exception as e:
        logger.error(f'Failed to update collection {collection_id}: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Collection update failed: {str(e)}',
            extra={**base_extra, 'error': str(e)},
        )
