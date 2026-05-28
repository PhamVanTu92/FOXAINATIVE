from __future__ import annotations

from pathlib import Path
from typing import Optional

from infrastructure.llm_vision import LLMVisionInput
from infrastructure.llm_vision import VisionLLMService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import Settings
from joint.utils.document_detection import DocumentDetectionService
from pydantic import Field

from .markitdown_service import MarkItDownInput
from .markitdown_service import MarkItDownService

logger = get_logger(__name__)

# Supported file extensions
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png'}
REJECTED_EXTENSIONS = {'.gif', '.bmp', '.webp', '.tiff', '.tif'}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
MARKITDOWN_EXTENSIONS = {'.docx', '.xlsx'}

# File upload constraints
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_FILES_PER_UPLOAD = 5


class FileProcessingInput(BaseModel):
    """Input for file processing service."""
    file_path: str = Field(..., description='Local path to the uploaded file')
    file_name: str = Field(..., description='Original file name')


class FileProcessingOutput(BaseModel):
    """Output from file processing service."""
    extracted_content: str = Field(..., description='Extracted text/description from file')
    file_name: str = Field(..., description='Original file name')
    processing_method: str = Field(..., description='Method used: markitdown, gemini_vision')


class FileProcessingService(BaseService):
    """Service for routing file processing to the appropriate handler.

    Routes based on file type:
    - PDF (text-based) -> MarkItDown
    - PDF (scanned) -> Gemini Vision
    - DOCX, XLSX -> MarkItDown
    - JPG, JPEG, PNG -> Gemini Vision
    """

    settings: Settings

    @property
    def markitdown_service(self) -> MarkItDownService:
        """Get MarkItDown service instance."""
        return MarkItDownService(settings=self.settings)

    @property
    def vision_service(self) -> VisionLLMService:
        """Get Vision LLM service instance."""
        return VisionLLMService(settings=self.settings)

    @property
    def document_detection(self) -> DocumentDetectionService:
        """Get document detection service instance."""
        return DocumentDetectionService()

    async def process(self, input_data: FileProcessingInput) -> FileProcessingOutput:
        """Process a file and extract its content.

        Routes to the appropriate processor based on file type:
        - PDF: detect scan vs text, then route accordingly
        - DOCX/XLSX: MarkItDown
        - Images (JPG/JPEG/PNG): Gemini Vision

        Args:
            input_data: FileProcessingInput with file path and name.

        Returns:
            FileProcessingOutput with extracted content and method used.

        Raises:
            ValueError: If file type is unsupported or rejected.
            RuntimeError: If processing fails.
        """
        ext = Path(input_data.file_name).suffix.lower()

        if ext in REJECTED_EXTENSIONS:
            raise ValueError(
                f'File type {ext} is not supported. '
                f'Rejected types: {", ".join(sorted(REJECTED_EXTENSIONS))}',
            )

        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f'Unsupported file type: {ext}. '
                f'Allowed types: {", ".join(sorted(ALLOWED_EXTENSIONS))}',
            )

        logger.info(f'Processing file: {input_data.file_name} (type: {ext})')

        if ext == '.pdf':
            return await self._process_pdf(input_data)
        elif ext in MARKITDOWN_EXTENSIONS:
            return await self._process_with_markitdown(input_data)
        elif ext in IMAGE_EXTENSIONS:
            return await self._process_with_vision(input_data)
        else:
            raise ValueError(f'No handler for file type: {ext}')

    async def _process_pdf(self, input_data: FileProcessingInput) -> FileProcessingOutput:
        """Process PDF file - detect scan vs text and route accordingly.

        Args:
            input_data: File processing input.

        Returns:
            FileProcessingOutput with extracted content.
        """
        pdf_type = self.document_detection.detect_pdf_type(input_data.file_path)
        logger.info(f'PDF type detected: {pdf_type} for {input_data.file_name}')

        if pdf_type == 'scan':
            return await self._process_with_vision(input_data)
        else:
            return await self._process_with_markitdown(input_data)

    async def _process_with_markitdown(self, input_data: FileProcessingInput) -> FileProcessingOutput:
        """Process file using MarkItDown.

        Args:
            input_data: File processing input.

        Returns:
            FileProcessingOutput with extracted markdown content.
        """
        markitdown_input = MarkItDownInput(
            file_path=input_data.file_path,
            file_name=input_data.file_name,
        )
        result = await self.markitdown_service.process(markitdown_input)

        return FileProcessingOutput(
            extracted_content=result.markdown_content,
            file_name=input_data.file_name,
            processing_method='markitdown',
        )

    async def _process_with_vision(self, input_data: FileProcessingInput) -> FileProcessingOutput:
        """Process file using Gemini Vision.

        Args:
            input_data: File processing input.

        Returns:
            FileProcessingOutput with vision-extracted content.
        """
        ext = Path(input_data.file_name).suffix.lower()
        prompt = (
            'Extract and describe all text content from this document in detail. '
            'Preserve the structure and formatting as much as possible.'
        ) if ext == '.pdf' else (
            'Describe this image in detail. Include all visible text, '
            'objects, diagrams, charts, and any other relevant information.'
        )

        vision_input = LLMVisionInput(
            prompt=prompt,
            file_path=input_data.file_path,
        )

        from infrastructure.llm_vision import VisionLLMInput
        service_input = VisionLLMInput(
            vision_input=vision_input,
            provider_name='gemini-vision',
        )
        result = await self.vision_service.process(service_input)

        return FileProcessingOutput(
            extracted_content=result.vision_output.description,
            file_name=input_data.file_name,
            processing_method='gemini_vision',
        )
