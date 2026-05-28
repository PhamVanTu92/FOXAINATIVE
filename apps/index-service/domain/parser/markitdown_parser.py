from __future__ import annotations

from typing import Optional

from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import Settings
from pydantic import BaseModel
from pydantic import Field

logger = get_logger(__name__)


class MarkItDownInput(BaseModel):
    """Input for MarkItDown document processing"""
    file_path: str = Field(..., description='Path to the document file')
    file_name: str = Field(..., description='Original file name')
    user_query: Optional[str] = Field(
        None, description='Optional user query about the document',
    )


class MarkItDownOutput(BaseModel):
    """Output from MarkItDown document processing"""
    markdown_content: str = Field(
        ...,
        description='Extracted content in markdown format',
    )
    file_name: str = Field(..., description='Original file name')


class MarkItDownService(BaseService):
    """Service to process documents (DOCX, XLSX, and text-based PDF) using MarkItDown library"""

    settings: Settings

    async def process(self, input_data: MarkItDownInput) -> MarkItDownOutput:
        """
        Process document file (DOCX/XLSX/PDF) and extract markdown content using MarkItDown

        Args:
            input_data: MarkItDownInput containing file path and metadata

        Returns:
            MarkItDownOutput with extracted markdown content

        Raises:
            ValueError: If file processing fails due to invalid format
            RuntimeError: If MarkItDown processing fails
        """
        logger.info(
            'Processing document with MarkItDown',
            extra={
                'file_name': input_data.file_name,
                'file_path': input_data.file_path,
            },
        )

        try:
            from markitdown import MarkItDown

            # Initialize MarkItDown without endpoint (using basic mode)
            md = MarkItDown()

            # Convert document to markdown
            result = md.convert(input_data.file_path)

            if not result or not result.text_content:
                raise ValueError(
                    f"MarkItDown returned empty content for file: {input_data.file_name}",
                )

            markdown_content = result.text_content

            # If user provided a query, append it as context
            if input_data.user_query:
                markdown_content = f"""# Document: {input_data.file_name}

## User Query
{input_data.user_query}

## Document Content
{markdown_content}
"""

            logger.info(
                'Successfully extracted content with MarkItDown',
                extra={
                    'file_name': input_data.file_name,
                    'content_length': len(markdown_content),
                },
            )

            return MarkItDownOutput(
                markdown_content=markdown_content,
                file_name=input_data.file_name,
            )

        except ImportError as e:
            logger.error(
                f"MarkItDown library not installed: {e}",
                exc_info=True,
                extra={'file_name': input_data.file_name},
            )
            raise RuntimeError(
                'MarkItDown library is not installed. Please install it with: pip install markitdown',
            )

        except ValueError as e:
            logger.error(
                f"Invalid document format: {e}",
                exc_info=True,
                extra={
                    'file_name': input_data.file_name,
                    'file_path': input_data.file_path,
                },
            )
            raise

        except Exception as e:
            logger.error(
                f"Error processing document with MarkItDown: {e}",
                exc_info=True,
                extra={
                    'file_name': input_data.file_name,
                    'file_path': input_data.file_path,
                },
            )
            raise RuntimeError(
                f"Failed to process document with MarkItDown: {str(e)}",
            )
