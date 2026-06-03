from __future__ import annotations

import os
import uuid
from enum import Enum
from pathlib import Path
from typing import Any
from typing import List
from urllib.parse import quote
from uuid import UUID

from domain.chunker.hierarchical_markdown_chunker import HierarchicalMarkdownChunker
from domain.db_service.document_services import CreatingDocumentInput
from domain.db_service.document_services import CreatingDocumentService
from domain.loader.excel_qa_loader import ExcelQALoaderInput
from domain.loader.excel_qa_loader import ExcelQALoaderService
from domain.parser.markitdown_parser import MarkItDownInput
from domain.parser.markitdown_parser import MarkItDownService
from domain.parser.pdf_batch_vision_parser import PDFBatchVisionInput
from domain.parser.pdf_batch_vision_parser import PDFBatchVisionService
from domain.storage_services import QdrantService
from domain.storage_services.qdrant.seeder import DocumentType
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.minio_storage import get_minio_service
from joint.minio_storage import MinioService
from joint.settings.defaults import DEFAULT_CHUNK_OVERLAP
from joint.settings.defaults import DEFAULT_CHUNK_SIZE
from joint.settings.settings import Settings
from joint.utils import cleanup_converted_file
from joint.utils import convert_doc_to_docx
from joint.utils import detect_content_type
from joint.utils import get_recommended_processing_type as _get_recommended_processing_type
from joint.utils import is_doc_file
from joint.utils import parse_datetime_string
from joint.postgres.database import ChunkController
from joint.postgres.database.schemas import Chunk as ChunkSchema

logger = get_logger(__name__)


class DocumentChunk:
    """
    Simple Document-like class for compatibility with Qdrant processing.
    Mimics LangChain Document structure with page_content and metadata.
    """

    def __init__(self, page_content: str, metadata: dict):
        self.page_content = page_content
        self.metadata = metadata


class DocumentProcessingType(str, Enum):
    """Enum for document processing types"""
    EXCEL = 'excel'  # Excel, CSV, XLS files - use excel_qa_loader
    # LLM vision for PDFs/images, MarkItDown for DOCX/PPTX/HTML
    DOCUMENT_STRUCTURED_LLM = 'document_structured_llm'


class DocumentCreationInput(BaseModel):
    """Input model for creating a document"""
    storage_path: str
    collection_id: UUID
    user_id: UUID
    collection_name: str
    processing_type: DocumentProcessingType
    effective_from: str | None = None
    effective_to: str | None = None
    issuing_unit: str | None = None
    access_scope: str | None = None
    version: str | None = None


class DocumentCreationOutput(BaseModel):
    """Output model for successful document creation"""
    message: str
    doc_name: str
    document_id: str
    minio_url: str


class DocumentCreationService(BaseService):

    settings: Settings
    provider_storage: str
    provider_embedding: str

    @property
    def excel_loader(self) -> ExcelQALoaderService:
        """Excel loader service for QA format processing"""
        return ExcelQALoaderService()

    @property
    def markitdown_service(self) -> MarkItDownService:
        """MarkItDown service for DOCX/PPTX processing"""
        return MarkItDownService(settings=self.settings)

    @property
    def pdf_batch_vision_service(self) -> PDFBatchVisionService:
        """PDF batch vision service for scanned PDFs"""
        return PDFBatchVisionService(settings=self.settings)

    @property
    def hierarchical_chunker(self) -> HierarchicalMarkdownChunker:
        """Hierarchical markdown chunker for document_structured_llm"""
        return HierarchicalMarkdownChunker(
            chunk_size=DEFAULT_CHUNK_SIZE,
            chunk_overlap=DEFAULT_CHUNK_OVERLAP,
        )

    @property
    def creating_document_service(self) -> CreatingDocumentService:
        return CreatingDocumentService(
            settings=self.settings.postgres,
        )

    @property
    def qdrant_service(self) -> QdrantService:
        return QdrantService(
            settings=self.settings,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
        )

    @property
    def minio_client(self) -> MinioService:
        return get_minio_service(self.settings)

    async def process(self, inputs: DocumentCreationInput, db_session=None) -> DocumentCreationOutput:
        """
        Creates a new document with complete flow:
        1. Save to MinIO storage
        2. Process and upload to Qdrant vector store
        3. Save metadata to PostgreSQL

        Args:
            inputs: DocumentCreationInput containing storage_path, collection_id, user_id

        Returns:
            DocumentCreationOutput with success message

        Raises:
            Exception: If document creation fails in any system
        """
        logger.info(
            f'Starting document creation process for file: {inputs.storage_path}',
        )

        if not inputs.storage_path or not Path(inputs.storage_path).exists():
            raise ValueError(f'File not found: {inputs.storage_path}')

        # Extract doc_name directly from filename (without extension)
        doc_name = Path(inputs.storage_path).stem
        logger.info(f'Document name: {doc_name}')

        # Determine file_type from extension
        file_type = Path(inputs.storage_path).suffix.lstrip('.').lower()

        # Handle file conversions
        converted_file_path = None

        if is_doc_file(inputs.storage_path):
            logger.info('Converting .doc file to .docx format')
            try:
                # Convert .doc to .docx
                converted_file_path = convert_doc_to_docx(inputs.storage_path)
                inputs.storage_path = converted_file_path
                file_type = 'docx'
                logger.info(
                    f'Successfully converted .doc to .docx: {converted_file_path}',
                )
            except Exception as e:
                logger.error(f'Failed to convert .doc file: {e}')
                raise ValueError(f'Failed to convert .doc file to .docx: {e}')

        try:
            # Step 1: Save file to MinIO storage
            logger.info('Saving file to MinIO storage')

            # Generate unique object name
            file_extension = Path(inputs.storage_path).suffix
            object_name = f'{uuid.uuid4()}_{doc_name}{file_extension}'
            bucket_name = self.settings.minio.bucket_name

            # Read file content
            with open(inputs.storage_path, 'rb') as file:
                file_content = file.read()

            # Upload to MinIO
            try:
                self.minio_client.ensure_bucket_exists(bucket_name)
                future = self.minio_client.upload_bytes(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    data=file_content,
                    content_type=detect_content_type(inputs.storage_path),
                )
                future.result()

                # Create public URL using the new public file API
                # Add '/files' to the public URL base
                encoded_object_name = quote(object_name, safe='/')
                minio_url = f"{self.settings.minio.public_url_base}/files/{bucket_name}/{encoded_object_name}"
                logger.info(
                    f'File uploaded to MinIO with public URL: {minio_url}',
                )

            except Exception as e:
                logger.error(f'Failed to upload to MinIO: {e}')
                raise ValueError(f'Failed to upload file to storage: {e}')

            # Step 2: Process document and create chunks
            logger.info(
                f'Converting document using processing type: {inputs.processing_type}',
            )
            doc_chunks = await self._process_document_by_type(inputs)

            if not doc_chunks:
                raise ValueError(
                    f'No chunks were generated from document: {inputs.storage_path}',
                )

            # Step 3: Save document metadata to PostgreSQL FIRST (to get document_id)
            logger.info('Saving document metadata to PostgreSQL')

            # Get original filename with extension
            original_filename = Path(inputs.storage_path).name

            db_input = CreatingDocumentInput(
                display_name=doc_name,  # Name without extension
                file_name=original_filename,  # Original filename with extension
                file_url=minio_url,  # MinIO URL for file access
                collection_id=inputs.collection_id,
                user_id=inputs.user_id,
                file_type=file_type,
                effective_from=parse_datetime_string(inputs.effective_from),
                effective_to=parse_datetime_string(inputs.effective_to),
                issuing_unit=inputs.issuing_unit,
                access_scope=inputs.access_scope,
                version=inputs.version,
                processing_status='completed',
                progress=100,
            )

            db_result = await self.creating_document_service.process(db_input, db_session)

            if not db_result.status:
                # If PostgreSQL save fails, cleanup MinIO and Qdrant
                logger.error(
                    f'Failed to save document metadata to PostgreSQL: {db_result.message}',
                )
                try:
                    self.minio_client.delete_object(bucket_name, object_name)
                    logger.info(
                        'Cleaned up MinIO object after PostgreSQL failure',
                    )
                except Exception as cleanup_error:
                    logger.warning(f'Failed to cleanup MinIO: {cleanup_error}')
                # Note: Qdrant cleanup would need collection-specific logic
                raise ValueError(
                    f'Failed to save document metadata: {db_result.message}',
                )

            if db_result.already_exists:
                logger.warning(f'Document already exists: {doc_name}')
                # Cleanup the newly uploaded MinIO file since document exists
                try:
                    self.minio_client.delete_object(bucket_name, object_name)
                    logger.info('Cleaned up duplicate MinIO object')
                except Exception as cleanup_error:
                    logger.warning(
                        f'Failed to cleanup duplicate MinIO: {cleanup_error}',
                    )

                return DocumentCreationOutput(
                    message=f"Document '{doc_name}' already exists in this collection",
                    doc_name=doc_name,
                    document_id=str(
                        db_result.document_id,
                    ) if db_result.document_id else 'unknown',
                    minio_url='',
                )

            # Step 4: Save chunks to PostgreSQL (now we have document_id)
            document_id = db_result.document_id
            # Step 4: Prepare chunk metadata for Qdrant
            logger.info(
                f'Preparing {len(doc_chunks)} chunks with metadata for Qdrant',
            )

            # Pre-generate all Qdrant point IDs to maintain consistency
            qdrant_point_ids = [uuid.uuid4() for _ in range(len(doc_chunks))]

            for idx, doc_chunk in enumerate(doc_chunks):
                # Use pre-generated Qdrant point ID
                qdrant_point_id = qdrant_point_ids[idx]

                # Prepare chunk metadata
                chunk_metadata = doc_chunk.metadata.copy() if hasattr(doc_chunk, 'metadata') else {}

                # Add metadata for Qdrant (chunk tracking via metadata only, no PostgreSQL storage)
                chunk_metadata['document_id'] = str(document_id)
                chunk_metadata['chunk_index'] = idx
                chunk_metadata['qdrant_point_id'] = str(qdrant_point_id)

                # Update doc_chunk metadata (will be used by Qdrant seeder)
                doc_chunk.metadata = chunk_metadata

            logger.info(f'Prepared {len(doc_chunks)} chunks with metadata')

            # Step 4b: Save chunks to PostgreSQL (bulk insert)
            logger.info(f'Saving {len(doc_chunks)} chunks to PostgreSQL')


            chunk_schemas = []
            for idx, doc_chunk in enumerate(doc_chunks):
                chunk_meta = doc_chunk.metadata.copy() if hasattr(doc_chunk, 'metadata') else {}
                chunk_id = uuid.uuid4()
                chunk_meta['chunk_id'] = str(chunk_id)
                chunk_meta['is_enabled'] = True
                chunk_schemas.append(ChunkSchema(
                    id=chunk_id,
                    document_id=document_id,
                    user_id=inputs.user_id,
                    chunk_index=idx,
                    content=doc_chunk.page_content if hasattr(doc_chunk, 'page_content') else str(doc_chunk),
                    content_length=len(doc_chunk.page_content) if hasattr(doc_chunk, 'page_content') else 0,
                    qdrant_point_id=qdrant_point_ids[idx],
                    metadata=chunk_meta,
                    is_enabled=True,
                    deleted=False,
                ))

            chunk_controller = ChunkController()
            chunk_controller.bulk_insert(db_session, chunk_schemas)
            db_session.commit()
            logger.info(f'Saved {len(chunk_schemas)} chunks to PostgreSQL')

            # Step 5: Upload chunks to Qdrant with metadata
            logger.info('Uploading chunks to Qdrant vector store')
            try:
                await self._upload_to_qdrant_by_type(
                    processing_type=inputs.processing_type,
                    doc_chunks=doc_chunks,
                    collection_name=inputs.collection_name,
                    effective_from=inputs.effective_from,
                    effective_to=inputs.effective_to,
                    issuing_unit=inputs.issuing_unit,
                    access_scope=inputs.access_scope,
                    version=inputs.version,
                )
                logger.info('Successfully uploaded chunks to Qdrant')
            except Exception as e:
                logger.error(f'Failed to upload to Qdrant: {e}')
                # Rollback: Delete document from Postgres and MinIO
                try:
                    from joint.postgres.database.controller.document_controller import DocumentController
                    doc_controller = DocumentController()
                    doc_controller.delete(db_session, document_id)
                    self.minio_client.delete_object(bucket_name, object_name)
                    logger.info(
                        'Rolled back document and MinIO after Qdrant failure',
                    )
                except Exception as rollback_error:
                    logger.error(f'Failed to rollback: {rollback_error}')
                raise ValueError(
                    f'Failed to upload document to vector store: {e}',
                )

            logger.info(
                f'Document creation completed successfully: {doc_name}',
            )

            return DocumentCreationOutput(
                message=f"Document '{doc_name}' created successfully",
                doc_name=doc_name,
                document_id=str(
                    db_result.document_id,
                ) if db_result.document_id else 'unknown',
                minio_url=minio_url,
            )

        except Exception as e:
            logger.error(
                f'Document creation failed for {inputs.storage_path}: {e}',
            )
            raise Exception(f'Document creation failed: {e}')
        finally:
            # Clean up temporary files
            if inputs.storage_path and os.path.exists(inputs.storage_path) and '/tmp' in inputs.storage_path:
                try:
                    os.remove(inputs.storage_path)
                    logger.info(
                        f'Cleaned up temporary file: {inputs.storage_path}',
                    )
                except Exception as cleanup_error:
                    logger.warning(
                        f'Failed to clean up file {inputs.storage_path}: {cleanup_error}',
                    )

            if converted_file_path:
                cleanup_converted_file(converted_file_path)

    async def _process_document_structured_llm(self, inputs: DocumentCreationInput) -> List[Any]:
        """
        Process document using LLM-based methods (DOCUMENT_STRUCTURED_LLM).

        Strategy:
        - ALL PDFs (scan or non-scan): Use PDF batch vision service with Gemini (10 pages per batch)
        - Images (PNG, JPG, JPEG, etc.): Use PDF batch vision service (single image batch)
        - DOCX/PPTX/HTML/TXT: Use MarkItDown parser
        - DOC: Convert to DOCX first, then use MarkItDown parser

        All outputs are processed with HierarchicalMarkdownChunker for consistent metadata.

        Args:
            inputs: Document creation input

        Returns:
            List of document chunks ready for Qdrant
        """
        file_path = inputs.storage_path
        file_ext = Path(file_path).suffix.lower()
        doc_name = Path(file_path).stem

        logger.info(
            f'Processing {file_ext} file with DOCUMENT_STRUCTURED_LLM: {doc_name}',
        )

        # Handle .doc file conversion to .docx
        converted_file_path = None
        if is_doc_file(file_path):
            logger.info(
                'Converting .doc file to .docx format for DOCUMENT_STRUCTURED_LLM',
            )
            try:
                converted_file_path = convert_doc_to_docx(file_path)
                file_path = converted_file_path
                file_ext = '.docx'
                logger.info(
                    f'Successfully converted .doc to .docx: {converted_file_path}',
                )
            except Exception as e:
                logger.error(f'Failed to convert .doc file: {e}')
                raise ValueError(f'Failed to convert .doc file to .docx: {e}')

        try:
            # Image extensions that should use Vision API
            image_extensions = {
                '.png', '.jpg', '.jpeg',
                '.gif', '.bmp', '.webp', '.tiff', '.tif',
            }

            # Document extensions that should use MarkItDown
            markitdown_extensions = {'.docx', '.pptx', '.html', '.htm', '.txt'}

            # Track processing method for metadata
            processing_method = 'llm_vision'
            markdown_text = ''

            # Determine processing strategy based on file type
            if file_ext == '.pdf':
                # Use PDF batch vision service for ALL PDFs (unified approach)
                logger.info(
                    'Using PDF batch vision service for PDF (10 pages per batch)',
                )
                processing_method = 'llm_vision'

                batch_result = await self.pdf_batch_vision_service.process(
                    PDFBatchVisionInput(
                        file_path=file_path,
                        file_name=doc_name,
                        pages_per_batch=10,
                        provider_name='gemini-vision',
                        user_query=None,
                    ),
                )

                markdown_text = batch_result.markdown_content

                logger.info(
                    f'Processed PDF: {batch_result.total_pages} pages in {batch_result.total_batches} batches',
                )

            elif file_ext in image_extensions:
                # Use PDF batch vision service for images (single image = 1 page)
                logger.info(
                    f'Using PDF batch vision service for image file: {file_ext}',
                )
                processing_method = 'llm_vision'

                batch_result = await self.pdf_batch_vision_service.process(
                    PDFBatchVisionInput(
                        file_path=file_path,
                        file_name=doc_name,
                        pages_per_batch=1,
                        provider_name='gemini-vision',
                        user_query=None,
                    ),
                )

                markdown_text = batch_result.markdown_content

                logger.info(
                    f'Processed image file with Vision API: {len(markdown_text)} chars',
                )

            elif file_ext in markitdown_extensions:
                # Use MarkItDown for DOCX/PPTX/HTML/TXT
                logger.info(f'Using MarkItDown for {file_ext} file')
                processing_method = 'markitdown'

                markitdown_result = await self.markitdown_service.process(
                    MarkItDownInput(
                        file_path=file_path,
                        file_name=f"{doc_name}{file_ext}",
                        user_query=None,
                    ),
                )

                markdown_text = markitdown_result.markdown_content

                logger.info(
                    f'Processed {file_ext} with MarkItDown: {len(markdown_text)} chars',
                )

            else:
                raise ValueError(
                    f'Unsupported file type for DOCUMENT_STRUCTURED_LLM: {file_ext}. '
                    f'Supported types: PDF, Images ({", ".join(image_extensions)}), '
                    f'Documents ({", ".join(markitdown_extensions)})',
                )

            # Use HierarchicalMarkdownChunker for all outputs (unified chunking)
            logger.info(
                'Using HierarchicalMarkdownChunker for hierarchical chunking with breadcrumbs',
            )
            hierarchical_chunks = self.hierarchical_chunker.chunk_markdown(
                markdown_text,
            )
            logger.info(
                f'Generated {len(hierarchical_chunks)} hierarchical chunks',
            )

            # Convert to DocumentChunk format for Qdrant
            doc_chunks = []

            for chunk in hierarchical_chunks:
                chunk_text = chunk.text
                chunk_metadata = chunk.metadata
                chunk_pages = chunk.pages  # Get pages from chunk attribute

                # Build clean metadata - only essential fields
                clean_metadata = {
                    'document_name': doc_name,
                    'processing_method': processing_method,
                    'file_type': file_ext.lstrip('.'),
                    'section_heading': chunk_metadata.get('section_heading', ''),
                    'chunk_strategy': chunk_metadata.get('chunk_strategy', 'hierarchical_semantic'),
                    'chunk_index': chunk_metadata.get('chunk_index', 0),
                    'page_number': chunk_pages,  # Use pages from chunk attribute
                }

                doc_chunks.append(
                    DocumentChunk(
                        page_content=chunk_text,
                        metadata=clean_metadata,
                    ),
                )

            logger.info(
                f'Converted {len(doc_chunks)} chunks to DocumentChunk format for DOCUMENT_STRUCTURED_LLM',
            )
            return doc_chunks

        finally:
            # Clean up converted file if it was created
            if converted_file_path:
                cleanup_converted_file(converted_file_path)

    async def _process_document_by_type(self, inputs: DocumentCreationInput) -> List[Any]:
        """
        Process document based on processing type

        Args:
            inputs: Document creation input with processing type (uses storage_path)

        Returns:
            List of document chunks
        """
        if inputs.processing_type == DocumentProcessingType.EXCEL:
            logger.info('Processing using Excel loader (EXCEL)')
            converted = await self.excel_loader.process(
                ExcelQALoaderInput(
                    path=inputs.storage_path,
                    sheet_name=None,  # Will process all sheets
                    process_all_sheets=True,  # Process all sheets by default
                ),
            )
            excel_chunks = converted.chunks
            logger.info(
                f'Generated {len(excel_chunks)} Excel chunks from document',
            )

            # Convert Excel Dict format to Document-like objects
            doc_chunks = []
            for chunk_dict in excel_chunks:
                # Start with base metadata from Excel loader (source, etc.)
                base_metadata = chunk_dict.get('metadata', {})

                # Create clean metadata with ONLY structural information
                # Do NOT include column data (already in page_content)
                chunk_metadata = {
                    'source': base_metadata.get('source', ''),
                    'row_index': base_metadata.get('row_index', 0),
                    'headers': base_metadata.get('headers', []),
                    'sheet_name': base_metadata.get('sheet_name', ''),
                }

                doc_chunks.append(
                    DocumentChunk(
                        page_content=chunk_dict.get('page_content', ''),
                        metadata=chunk_metadata,
                    ),
                )

            logger.info(
                f'Converted {len(doc_chunks)} Excel chunks to Document format with full metadata',
            )
            return doc_chunks
        elif inputs.processing_type == DocumentProcessingType.DOCUMENT_STRUCTURED_LLM:
            logger.info(
                'Processing using DOCUMENT_STRUCTURED_LLM (LLM vision for scanned PDFs, MarkItDown for DOCX/PPTX)',
            )
            return await self._process_document_structured_llm(inputs)
        else:
            raise ValueError(
                f'Unsupported processing type: {inputs.processing_type}',
            )

    async def _upload_to_qdrant_by_type(
        self,
        processing_type: DocumentProcessingType | str,
        doc_chunks: List[Any],
        collection_name: str,
        effective_from: str | None = None,
        effective_to: str | None = None,
        issuing_unit: str | None = None,
        access_scope: str | None = None,
        version: str | None = None,
    ) -> None:
        """
        Upload document chunks to Qdrant based on processing type, with extra metadata.

        Args:
            processing_type: Type of document processing (enum or string)
            doc_chunks: List of document chunks
            collection_name: Name of the Qdrant collection
            effective_from, effective_to, issuing_unit, access_scope, version: Metadata for Qdrant
        """
        # Normalize processing_type to string for comparison
        processing_type_str = processing_type.value if isinstance(
            processing_type, DocumentProcessingType,
        ) else processing_type

        metadata = {
            'effective_from': effective_from,
            'effective_to': effective_to,
            'issuing_unit': issuing_unit,
            'access_scope': access_scope,
            'version': version,
        }

        if processing_type_str == 'excel':
            await self.qdrant_service.seed_excel(
                chunks=doc_chunks,
                collection_name=collection_name,
                metadata=metadata,
            )
            logger.info(
                'Successfully uploaded Excel document chunks to Qdrant',
            )
        elif processing_type_str == 'document_structured_llm':
            await self.qdrant_service.seed(
                data=doc_chunks,
                collection_name=collection_name,
                document_type=DocumentType.STRUCTURED,
                metadata=metadata,
            )
            logger.info(
                'Successfully uploaded document_structured_llm chunks to Qdrant',
            )
        else:
            raise ValueError(
                f'Unsupported processing type: {processing_type_str}',
            )

    @staticmethod
    def get_recommended_processing_type(file_path: str) -> DocumentProcessingType:
        """
        Get recommended processing type based on file extension.

        Args:
            file_path: Path to the file

        Returns:
            Recommended DocumentProcessingType
        """
        processing_type_str = _get_recommended_processing_type(file_path)

        type_mapping = {
            'excel': DocumentProcessingType.EXCEL,
            'document_structured_llm': DocumentProcessingType.DOCUMENT_STRUCTURED_LLM,
        }

        return type_mapping.get(processing_type_str, DocumentProcessingType.DOCUMENT_STRUCTURED_LLM)
