from __future__ import annotations

from typing import Any
from typing import Dict
from typing import List
from typing import Optional

from joint.logging.logger import get_logger
from langchain.schema import Document

logger = get_logger(__name__)


class QdrantDocumentProcessor:
    """Handles document processing for different types before seeding to Qdrant"""

    @staticmethod
    def process_structured_documents(data: List[Any]) -> List[Document]:
        """
        Process structured documents (from markdown chunker or document loader).

        Metadata is already complete from create_document.py, use as-is.

        Args:
            data: List of document chunks with metadata

        Returns:
            List[Document]: Processed documents ready for Qdrant
        """
        return [
            Document(
                page_content=doc.page_content,
                metadata=doc.metadata.copy() if doc.metadata else {},
            )
            for doc in data
        ]

    @staticmethod
    def process_excel_qa_chunks(chunks: List[Any]) -> List[Document]:
        """
        Process Excel QA chunks.

        Args:
            chunks: List of QA chunks (DocumentChunk objects) from ExcelQALoaderService

        Returns:
            List[Document]: Processed documents ready for Qdrant
        """
        documents = []

        for chunk in chunks:
            try:
                # DocumentChunk has page_content and metadata attributes
                page_content = chunk.page_content
                chunk_metadata = chunk.metadata if chunk.metadata else {}

                # Extract data fields from metadata
                chunk_data = chunk_metadata.get('data', {})

                # Get document name from chunk metadata
                doc_name = chunk_metadata.get('source', '')
                if doc_name and '.' in doc_name:
                    doc_name = doc_name.rsplit('.', 1)[0]  # Remove extension

                # Start with base Qdrant metadata
                qdrant_metadata = {
                    'document_name': doc_name,
                    'row_index': chunk_metadata.get('row_index', 0),
                    'headers': chunk_metadata.get('headers', []),
                    # Add sheet name info
                    'sheet_name': chunk_metadata.get('sheet_name', ''),
                    **chunk_data,  # Add all data fields as searchable metadata
                }

                # Preserve important fields from chunk_metadata (if they exist)
                preserve_fields = [
                    'qdrant_point_id', 'document_id', 'chunk_id', 'is_enabled',
                    'chunk_index', 'file_type', 'processing_method', 'file_url',
                ]
                for field in preserve_fields:
                    if field in chunk_metadata and chunk_metadata[field] is not None:
                        qdrant_metadata[field] = chunk_metadata[field]

                documents.append(
                    Document(
                        page_content=page_content,
                        metadata=qdrant_metadata,
                    ),
                )

            except Exception as e:
                logger.warning(f'Failed to process Excel QA chunk: {e}')
                continue

        return documents

    @staticmethod
    def add_extra_metadata(documents: List[Document], metadata: Optional[Dict[str, Any]] = None) -> List[Document]:
        """
        Add extra metadata to all documents.

        Args:
            documents: List of documents to add metadata to
            metadata: Extra metadata to add

        Returns:
            List[Document]: Documents with added metadata
        """
        if not metadata:
            return documents

        for doc in documents:
            for k, v in metadata.items():
                if v is not None:
                    doc.metadata[k] = v

        return documents
