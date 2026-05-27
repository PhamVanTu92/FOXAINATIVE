from __future__ import annotations

from enum import Enum
from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from uuid import uuid4

from joint.logging.logger import get_logger

from .client import QdrantClient
from .document_processor import QdrantDocumentProcessor

logger = get_logger(__name__)


class DocumentType(str, Enum):
    """Enum for document types in seeding"""
    EXCEL = 'excel'
    STRUCTURED = 'structured'


class QdrantSeeder(QdrantClient):
    """Handles seeding operations for Qdrant with different document types"""

    _processor = None

    @property
    def processor(self) -> QdrantDocumentProcessor:
        """Lazy loading document processor with caching"""
        if self._processor is None:
            self._processor = QdrantDocumentProcessor()
        return self._processor

    async def seed(
        self,
        data: List[Any],
        collection_name: str,
        document_type: DocumentType = DocumentType.STRUCTURED,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Seeds a Qdrant vector store with documents.

        Args:
            data: List of document chunks to be indexed
            collection_name: Name of the collection to seed
            document_type: Type of document to process (EXCEL or STRUCTURED)
            metadata: Extra metadata to add to all documents
        """
        try:
            logger.info(
                'Received %s data with %d records',
                document_type.value, len(data),
            )

            if document_type == DocumentType.EXCEL:
                documents = self.processor.process_excel_qa_chunks(data)
            elif document_type == DocumentType.STRUCTURED:
                documents = self.processor.process_structured_documents(data)
            else:
                raise ValueError(f'Unsupported document type: {document_type}')

            if not documents:
                logger.warning(
                    'No valid %s documents to insert.',
                    document_type.value,
                )
                return

            # Add extra metadata if provided
            documents = self.processor.add_extra_metadata(documents, metadata)

            # Insert to Qdrant
            await self._insert_documents(documents, collection_name)
            logger.info(
                'Added %s documents to Qdrant successfully!',
                document_type.value,
            )

        except Exception as e:
            logger.error(
                f'Failed to seed vectorstore with %s data: {e}', document_type.value,
            )
            raise

    async def seed_excel(self, chunks: List[Dict[str, Any]], collection_name: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Backward compatible method for Excel seeding."""
        await self.seed(chunks, collection_name, DocumentType.EXCEL, metadata)

    async def _insert_documents(self, documents: List[Any], collection_name: str) -> None:
        """
        Internal method to insert documents into Qdrant.

        Args:
            documents: List of processed documents ready for insertion
            collection_name: Name of the collection
        """
        try:
            # Extract qdrant_point_id from metadata (set in create_document.py)
            uuids = []
            for doc in documents:
                if 'qdrant_point_id' in doc.metadata:
                    # Use pre-assigned qdrant_point_id from Postgres chunk metadata
                    uuids.append(doc.metadata['qdrant_point_id'])
                else:
                    # Generate new UUID if not provided (backward compatibility for old flow)
                    new_uuid = str(uuid4())
                    uuids.append(new_uuid)
                    logger.warning(
                        f'Document missing qdrant_point_id in metadata, generated new UUID: {new_uuid}',
                    )

            vectorstore = await self.initial_vectorstore(collection_name=collection_name)
            logger.info('Connecting to Qdrant vector store successfully!')

            vectorstore.add_documents(documents=documents, ids=uuids)
            logger.info(
                f'Added {len(documents)} documents to Qdrant successfully!',
            )

        except Exception as e:
            logger.error(f'Failed to insert documents to vectorstore: {e}')
            raise
