"""
Collection validation dependencies for FastAPI endpoints.

This module provides dependency functions to validate collections
and ensure they belong to the correct organization.
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from fastapi import status
from joint.logging import get_logger
from joint.postgres.database import CollectionController
from joint.postgres.database import DocumentController
from sqlalchemy.orm import Session

logger = get_logger(__name__)


def get_collection_name_by_id(
    collection_id: uuid.UUID,
    db: Session,
) -> str:
    """
    Validate collection exists and return collection_name.

    This function validates that:
    1. Collection with collection_id exists in the database
    2. Returns the collection_name for use in services

    Args:
        collection_id: UUID of the collection to validate
        db: Database session for querying

    Returns:
        str: The collection_name if validation passes

    Raises:
        HTTPException: If collection not found
            - 404: Collection not found
            - 422: Invalid collection ID format
    """
    try:
        # Validate collection_id format
        if not collection_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Collection ID is required',
            )

        # Check for nil UUID (all zeros)
        nil_uuid = uuid.UUID('00000000-0000-0000-0000-000000000000')
        if collection_id == nil_uuid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Collection ID cannot be nil UUID',
            )

        # Get collection controller
        collection_controller = CollectionController()

        # Find collection by ID
        collection = collection_controller.get_by_id(
            session=db,
            id=collection_id,
        )

        if not collection:
            logger.warning(
                f'Collection not found with ID: {collection_id}',
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection with ID '{collection_id}' not found",
            )

        logger.info(
            f'Collection validation successful: {collection.collection_name} '
            f'(ID: {collection_id})',
        )

        return collection.collection_name

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        logger.error(f'Invalid collection ID format {collection_id}: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid collection ID format: {str(e)}",
        )
    except Exception as e:
        logger.error(
            f'Error validating collection {collection_id}: {str(e)}',
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate collection: {str(e)}",
        )


def get_collection_name_by_document_id(
    document_id: uuid.UUID,
    db: Session,
) -> str:
    """
    Get collection_name from document_id.

    This function:
    1. Finds document by document_id
    2. Gets collection_id from document
    3. Returns collection_name

    Args:
        document_id: UUID of the document
        db: Database session for querying

    Returns:
        str: The collection_name if validation passes

    Raises:
        HTTPException: If document or collection not found
            - 404: Document or collection not found
            - 422: Invalid document ID format
    """
    try:
        # Validate document_id format
        if not document_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Document ID is required',
            )

        # Check for nil UUID (all zeros)
        nil_uuid = uuid.UUID('00000000-0000-0000-0000-000000000000')
        if document_id == nil_uuid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Document ID cannot be nil UUID',
            )

        # Get document controller
        document_controller = DocumentController()

        # Find document by ID
        document = document_controller.get_by_id(
            session=db,
            id=document_id,
        )

        if not document:
            logger.warning(
                f'Document not found with ID: {document_id}',
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{document_id}' not found",
            )

        # Get collection controller
        collection_controller = CollectionController()

        # Find collection by ID from document
        collection = collection_controller.get_by_id(
            session=db,
            id=document.collection_id,
        )

        if not collection:
            logger.warning(
                f'Collection not found with ID: {document.collection_id} for document: {document_id}',
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection not found for document '{document_id}'",
            )

        logger.info(
            f'Document validation successful: {collection.collection_name} '
            f'(document_id: {document_id}, collection_id: {document.collection_id})',
        )

        return collection.collection_name

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        logger.error(f'Invalid document ID format {document_id}: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid document ID format: {str(e)}",
        )
    except Exception as e:
        logger.error(
            f'Error getting collection from document {document_id}: {str(e)}',
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get collection for document: {str(e)}",
        )
