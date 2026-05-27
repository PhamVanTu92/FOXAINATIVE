from __future__ import annotations

from pathlib import Path

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import Settings
from pydantic import Field

logger = get_logger(__name__)


class MarkItDownInput(BaseModel):
    """Input for MarkItDown document processing."""
    file_path: str = Field(..., description='Path to the document file')
    file_name: str = Field(..., description='Original file name')


class MarkItDownOutput(BaseModel):
    """Output from MarkItDown document processing."""
    markdown_content: str = Field(..., description='Extracted content in markdown format')
    file_name: str = Field(..., description='Original file name')


class MarkItDownService(BaseService):
    """Service to process documents (DOCX, XLSX, text-based PDF) using MarkItDown."""

    settings: Settings

    async def process(self, input_data: MarkItDownInput) -> MarkItDownOutput:
        """Process document file and extract markdown content using MarkItDown.

        Args:
            input_data: MarkItDownInput containing file path and metadata.

        Returns:
            MarkItDownOutput with extracted markdown content.

        Raises:
            ValueError: If file processing fails due to invalid format.
            RuntimeError: If MarkItDown processing fails.
        """
        logger.info(
            f'Processing document with MarkItDown: {input_data.file_name}',
        )

        try:
            from markitdown import MarkItDown

            md = MarkItDown()
            result = md.convert(input_data.file_path)

            if not result or not result.text_content:
                raise ValueError(
                    f'MarkItDown returned empty content for file: {input_data.file_name}',
                )

            logger.info(
                f'Successfully extracted content with MarkItDown: {input_data.file_name} '
                f'({len(result.text_content)} chars)',
            )

            return MarkItDownOutput(
                markdown_content=result.text_content,
                file_name=input_data.file_name,
            )

        except ImportError as e:
            logger.error(f'MarkItDown library not installed: {e}', exc_info=True)
            raise RuntimeError(
                'MarkItDown library is not installed. Please install it with: pip install markitdown',
            )

        except ValueError:
            raise

        except Exception as e:
            logger.error(
                f'Error processing document with MarkItDown: {e}', exc_info=True,
            )
            raise RuntimeError(f'Failed to process document with MarkItDown: {e}')
