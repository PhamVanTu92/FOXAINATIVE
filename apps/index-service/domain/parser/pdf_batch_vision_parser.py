"""
PDF/Image Batch Vision Parser for processing scanned documents and images.

This parser handles:
- Large scanned PDFs: Splits into batches (10 pages each) and processes with Gemini Vision API
- Image files: Processes as single-page batch (PNG, JPG, JPEG, GIF, BMP, WEBP, TIFF)

Results are merged with page metadata preserved.
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any
from typing import Dict
from typing import Optional

import fitz  # PyMuPDF
from infrastructure.llm_vision import LLMVisionInput
from infrastructure.llm_vision import VisionLLMInput
from infrastructure.llm_vision import VisionLLMService
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import Settings
from pydantic import BaseModel
from pydantic import Field

logger = get_logger(__name__)


class PDFBatchVisionInput(BaseModel):
    """Input for PDF/Image batch vision processing"""
    file_path: str = Field(..., description='Path to the PDF or image file')
    file_name: str = Field(..., description='Original file name')
    pages_per_batch: int = Field(
        default=10, description='Number of pages to process per batch (use 1 for images)',
    )
    provider_name: str = Field(
        default='gemini-vision', description='Vision provider to use',
    )
    user_query: Optional[str] = Field(
        None, description='Optional user query about the document',
    )


class PDFBatchVisionOutput(BaseModel):
    """Output from PDF batch vision processing"""
    markdown_content: str = Field(
        ...,
        description='Merged markdown content from all batches',
    )
    file_name: str = Field(..., description='Original file name')
    total_pages: int = Field(
        ...,
        description='Total number of pages processed',
    )
    total_batches: int = Field(..., description='Total number of batches')


class PDFBatchVisionService(BaseService):
    """
    Service to process scanned PDFs and images using Vision LLM.

    Supports:
    - Scanned PDFs: Batch processing (default: 10 pages per batch)
    - Images (PNG, JPG, etc.): Single-item processing

    Workflow:
    1. Split document into batches (for PDFs) or process as single item (for images)
    2. For each batch:
       - Extract pages/image as temporary file
       - Process with Gemini Vision API
       - Extract markdown content with page/image metadata
    3. Merge all batch results with metadata preserved
    """

    settings: Settings

    @property
    def vision_llm_service(self) -> VisionLLMService:
        """Get Vision LLM service instance."""
        return VisionLLMService(settings=self.settings)

    async def process(self, input_data: PDFBatchVisionInput) -> PDFBatchVisionOutput:
        """
        Process scanned PDF or image using Vision LLM.

        Handles both PDFs (with batch processing) and images (single batch).

        Args:
            input_data: PDFBatchVisionInput containing file path and settings

        Returns:
            PDFBatchVisionOutput with merged markdown content and page metadata

        Raises:
            ValueError: If file processing fails
            RuntimeError: If Vision LLM processing fails
        """
        logger.info(
            f"Processing document with Vision LLM: {input_data.file_name}",
            extra={
                'file_name': input_data.file_name,
                'file_path': input_data.file_path,
                'pages_per_batch': input_data.pages_per_batch,
                'provider': input_data.provider_name,
            },
        )

        try:
            # Check if file is an image (not a PDF)
            file_ext = Path(input_data.file_path).suffix.lower()
            image_extensions = {
                '.png', '.jpg', '.jpeg',
                '.gif', '.bmp', '.webp', '.tiff', '.tif',
            }

            if file_ext in image_extensions:
                # Process as single image (no need for fitz/PyMuPDF)
                logger.info(
                    f"Processing image file: {input_data.file_name} ({file_ext})",
                )

                # Process image directly with Vision API (no batch splitting)
                batch_result = await self._process_image_file(
                    file_path=input_data.file_path,
                    file_name=input_data.file_name,
                    provider_name=input_data.provider_name,
                    user_query=input_data.user_query,
                )

                all_markdown_parts = [batch_result['markdown']]
                total_pages = 1
                total_batches = 1

                logger.info(
                    f"Image processing completed: {len(batch_result['markdown'])} chars",
                )

            else:
                # Process as PDF with batch splitting
                logger.info(f"Processing PDF file: {input_data.file_name}")

                # Open PDF and get total pages
                pdf_document = fitz.open(input_data.file_path)
                total_pages = len(pdf_document)

                logger.info(
                    f"PDF has {total_pages} pages, will process in batches of {input_data.pages_per_batch}",
                )

                # Calculate number of batches
                total_batches = (
                    total_pages + input_data.pages_per_batch - 1
                ) // input_data.pages_per_batch

                # Process each batch
                all_markdown_parts = []

                for batch_idx in range(total_batches):
                    start_page = batch_idx * input_data.pages_per_batch
                    end_page = min(
                        start_page + input_data.pages_per_batch, total_pages,
                    )

                    logger.info(
                        f"Processing batch {batch_idx + 1}/{total_batches}: pages {start_page + 1}-{end_page}",
                    )

                    # Process this batch
                    batch_result = await self._process_batch(
                        pdf_document=pdf_document,
                        start_page=start_page,
                        end_page=end_page,
                        batch_number=batch_idx + 1,
                        file_name=input_data.file_name,
                        provider_name=input_data.provider_name,
                        user_query=input_data.user_query,
                    )

                    all_markdown_parts.append(batch_result['markdown'])

                    logger.info(
                        f"Batch {batch_idx + 1}/{total_batches} completed successfully",
                    )

                pdf_document.close()

            # Merge all markdown parts (simple concatenation)
            merged_markdown = '\n\n'.join(all_markdown_parts)

            logger.info(
                f"Successfully processed {total_pages} pages in {total_batches} batches",
                extra={
                    'total_pages': total_pages,
                    'total_batches': total_batches,
                    'markdown_length': len(merged_markdown),
                },
            )

            return PDFBatchVisionOutput(
                markdown_content=merged_markdown,
                file_name=input_data.file_name,
                total_pages=total_pages,
                total_batches=total_batches,
            )

        except Exception as e:
            logger.error(
                f"Error processing PDF in batches: {e}",
                exc_info=True,
                extra={
                    'file_name': input_data.file_name,
                    'file_path': input_data.file_path,
                },
            )
            raise RuntimeError(f"Failed to process scanned PDF: {str(e)}")

    async def _process_image_file(
        self,
        file_path: str,
        file_name: str,
        provider_name: str,
        user_query: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process a single image file with Vision LLM (no PDF batch splitting needed).

        Args:
            file_path: Path to the image file
            file_name: Original file name
            provider_name: Vision provider name
            user_query: Optional user query

        Returns:
            Dict with 'markdown' key
        """
        try:
            logger.info(f"Processing image file: {file_name}")

            # Build prompt for vision LLM
            prompt = self._build_image_prompt(
                file_name=file_name,
                user_query=user_query,
            )

            # Process with vision LLM (directly, no temp file needed)
            vision_input = VisionLLMInput(
                vision_input=LLMVisionInput(
                    prompt=prompt,
                    file_path=file_path,
                    image_url='',  # Not used when file_path is provided
                    max_tokens=8092,
                    temperature=0.1,
                ),
                provider_name=provider_name,
            )

            vision_output = await self.vision_llm_service.process(vision_input)
            markdown_content = vision_output.vision_output.description

            logger.info(
                f"Image processed successfully: {len(markdown_content)} chars",
                extra={
                    'markdown_length': len(markdown_content),
                    'file_name': file_name,
                },
            )

            return {
                'markdown': markdown_content,
            }

        except Exception as e:
            logger.error(f"Error processing image file: {e}", exc_info=True)
            raise RuntimeError(f"Failed to process image: {str(e)}")

    async def _process_batch(
        self,
        pdf_document: fitz.Document,
        start_page: int,
        end_page: int,
        batch_number: int,
        file_name: str,
        provider_name: str,
        user_query: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process a single batch of PDF pages with Vision LLM.

        Args:
            pdf_document: PyMuPDF document object
            start_page: Starting page index (0-based)
            end_page: Ending page index (exclusive)
            batch_number: Batch number for logging
            file_name: Original file name
            provider_name: Vision provider name
            user_query: Optional user query

        Returns:
            Dict with 'markdown' key
        """
        temp_pdf_path = None

        try:
            # Create temporary PDF for this batch
            temp_pdf = fitz.open()
            temp_pdf.insert_pdf(
                pdf_document, from_page=start_page, to_page=end_page - 1,
            )

            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                temp_pdf_path = temp_file.name
                temp_pdf.save(temp_pdf_path)

            temp_pdf.close()

            logger.info(
                f"Created temporary PDF for batch {batch_number}: {temp_pdf_path}",
            )

            # Build prompt for vision LLM
            prompt = self._build_batch_prompt(
                file_name=file_name,
                batch_number=batch_number,
                start_page=start_page + 1,  # Convert to 1-based
                end_page=end_page,
                user_query=user_query,
            )

            # Process with vision LLM
            vision_input = VisionLLMInput(
                vision_input=LLMVisionInput(
                    prompt=prompt,
                    file_path=temp_pdf_path,
                    image_url='',  # Not used when file_path is provided
                    max_tokens=8092,
                    temperature=0,
                ),
                provider_name=provider_name,
            )

            vision_output = await self.vision_llm_service.process(vision_input)
            markdown_content = vision_output.vision_output.description

            logger.info(
                f"Batch {batch_number}: Generated markdown content",
                extra={
                    'markdown_length': len(markdown_content),
                },
            )

            return {
                'markdown': markdown_content,
            }

        finally:
            # Clean up temporary file
            if temp_pdf_path and Path(temp_pdf_path).exists():
                try:
                    Path(temp_pdf_path).unlink()
                    logger.debug(f"Cleaned up temporary PDF: {temp_pdf_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary PDF: {e}")

    def _build_batch_prompt(
        self,
        file_name: str,
        batch_number: int,
        start_page: int,
        end_page: int,
        user_query: Optional[str] = None,
    ) -> str:
        """Build prompt for Vision LLM batch processing."""
        page_count = end_page - start_page + 1
        base_prompt = f"""You are an expert document digitization system.
Your task is to convert Pages {start_page}-{end_page} ({page_count} pages total) from "{file_name}" into clean, structured Markdown format.

CORE REQUIREMENTS

1. PAGE MARKERS (CRITICAL):
   - For EACH page, start with: <!-- PAGE: N --> (where N is the page number)
   - Process ALL {page_count} pages in order ({start_page} to {end_page})

2. LANGUAGE PRESERVATION:
   - Keep the ORIGINAL language(s) of the document (Vietnamese, English, Chinese, etc.)
   - Do NOT translate or modify the actual content
   - Preserve special characters, diacritics, and unicode

3. STRICT MARKDOWN ONLY:
   - Use ONLY standard Markdown syntax
   - NEVER use HTML tags (<br>, <div>, <p>, <table>, <span>, etc.)
   - NO inline styles or custom formatting
   - DO NOT generate extra white space or blank lines that do not need to be there


CONTENT STRUCTURE HANDLING

DOCUMENT TITLE MARKER (CRITICAL - REQUIRED):
- MANDATORY: Identify the MAIN document title (usually on first page) and mark it with [DOC_TITLE]
- Examples:
  * # [DOC_TITLE] QUYET DINH VE VIEC BAN HANH QUY CHE...
  * # [DOC_TITLE] Annual Financial Report 2024
  * # [DOC_TITLE] User Manual for Product XYZ
- The main title is typically:
  * The document name/title (not chapter/section titles)
  * Usually the largest/most prominent text on first page
  * The overall subject of the entire document
  * Should appear ONCE (only the main document title)

HEADINGS & HIERARCHY:
- Detect document structure naturally (titles, chapters, sections, subsections)
- Main document title -> # [DOC_TITLE] Title Text (see above - REQUIRED)
- Major sections/chapters -> ## Section Title
- Subsections -> ### Subsection Title
- Minor headings -> ####, #####, ######
- ALWAYS combine numbering with titles on ONE line:
  GOOD: ## Chapter 3: Implementation Guidelines
  BAD:  ## Chapter 3
        ## Implementation Guidelines

LISTS:
- Numbered lists -> Use 1., 2., 3., etc.
- Bullet points -> Use - or *
- Nested lists -> Indent with 2-4 spaces
- Preserve original list structure and hierarchy

TABLES:
- Convert ALL tabular data to Markdown pipe tables
- CRITICAL: Include BOTH headers AND all data rows
- Table structure:
  | Header 1 | Header 2 | Header 3 |
  |----------|----------|----------|
  | Data 1   | Data 2   | Data 3   |
  | Data 4   | Data 5   | Data 6   |
- NEVER output only headers and separators without data
- NEVER create empty table rows
- For each row of data in the original table, create a corresponding row in Markdown
- Preserve all cell content accurately (numbers, text, formulas)
- Use :---, :---:, or ---: in separator row for alignment (left, center, right)
- For complex tables with merged cells:
  * Try to represent structure as best as possible
  * If impossible, describe the table content in plain text with a note: [Complex Table: Description...]
- Multi-row headers: combine into single header row where possible
- Empty cells: use space or - to indicate empty cells, do not skip them

TEXT FORMATTING:
- Bold -> **bold text**
- Italic -> *italic text*
- Code/monospace -> `code`
- Links -> [link text](url) (if URLs are visible)

SPECIAL CONTENT:
- Mathematical formulas -> Use LaTeX notation: $inline$ or $$block$$
- Code blocks -> Use ``` with language identifier
- Quotes/citations -> Use > blockquote syntax
- Horizontal rules -> Use --- or ***

IMAGES/DIAGRAMS:
- Describe visual content: [Image: Description of what is shown]
- For charts/graphs: [Chart: Description of data and trends]
- For diagrams: [Diagram: Description of structure and flow]

FORMATTING GUIDELINES

SPACING:
- Use single blank line between paragraphs
- Use single blank line before/after headings, lists, tables, code blocks
- Do NOT use multiple consecutive blank lines
- Do NOT use spaces/newlines to simulate page layout

ACCURACY:
- Preserve exact text content (no summarization or paraphrasing)
- Maintain original punctuation and capitalization
- Keep numbers, dates, references exactly as shown
- Preserve footnotes and endnotes with markers

QUALITY:
- Clean OCR artifacts if present (weird characters, broken words)
- Fix obvious scanning errors (e.g., l0 -> 10, rn -> m if contextually wrong)
- Maintain readability while staying faithful to source

OUTPUT FORMAT

Return ONLY the converted Markdown content in this exact format:

<!-- PAGE: {start_page} -->
[Full content of page {start_page}]

<!-- PAGE: {start_page + 1} -->
[Full content of page {start_page + 1}]

...continue for all {page_count} pages...

<!-- PAGE: {end_page} -->
[Full content of page {end_page}]

NO explanations, NO metadata, NO comments - JUST the Markdown content.
"""

        if user_query:
            base_prompt += f"""

USER QUERY CONTEXT:
A user has provided this question: "{user_query}"

While extracting all content, pay special attention to information relevant to this query.
Ensure that relevant sections are well-structured and contain enough context to answer the question when retrieved later.
"""

        return base_prompt

    def _build_image_prompt(
        self,
        file_name: str,
        user_query: Optional[str] = None,
    ) -> str:
        """Build prompt for Vision LLM image processing."""
        base_prompt = f"""You are an expert document digitization system.
Your task is to convert the provided document image from "{file_name}" into clean, structured Markdown format.

CORE REQUIREMENTS

1. COMPLETE TEXT OCR:
   - Extract ALL visible text exactly as written
   - Preserve original language, terminology, and technical terms
   - Include headers, titles, labels, captions, footnotes
   - Maintain hierarchical structure (titles -> sections -> subsections)

2. LANGUAGE PRESERVATION:
   - Keep the ORIGINAL language(s) (Vietnamese, English, Chinese, etc.)
   - Do NOT translate or modify content
   - Preserve special characters and unicode

3. STRICT MARKDOWN ONLY:
   - Use ONLY standard Markdown syntax
   - NEVER use HTML tags
   - NO inline styles or custom formatting
   - DO NOT generate extra white space or blank lines that do not need to be there

CONTENT STRUCTURE HANDLING

DOCUMENT TITLE MARKER (CRITICAL - REQUIRED):
- MANDATORY: Identify the MAIN document title and mark it with [DOC_TITLE]
- Examples:
  * # [DOC_TITLE] Annual Financial Report 2024
  * # [DOC_TITLE] User Manual for Product XYZ
- The main title is typically:
  * The document name/title (not chapter/section titles)
  * Usually the largest/most prominent text
  * The overall subject of the document
  * Should appear ONCE

VISUAL CONTENT DESCRIPTION:
- Charts/Graphs: Describe type (bar, line, pie), axes labels, data trends, key insights
- Diagrams/Flowcharts: Explain components, relationships, flow direction, process steps
- Tables: Extract all rows, columns, and data points in Markdown table format
- Infographics: Describe layout, key messages, data visualizations
- Photos/Images: Describe subjects, context, important details

HEADINGS & HIERARCHY:
- Main document title -> # [DOC_TITLE] Title Text (REQUIRED)
- Major sections -> ## Section Title
- Subsections -> ### Subsection Title
- ALWAYS combine numbering with titles on ONE line:
  GOOD: ## Section 2: Overview
  BAD:  ## Section 2
        ## Overview

TABLES:
- Convert to Markdown pipe tables with headers AND all data rows
- Include all cell content (numbers, text)
- Use :---, :---:, ---: for alignment
- For complex tables: describe in plain text with [Complex Table: ...]

TEXT FORMATTING:
- Bold -> **bold text**
- Italic -> *italic text*
- Code -> `code`
- Links -> [text](url)

METADATA EXTRACTION:
- Document type/category
- Date/version if visible
- Author/organization if mentioned
- Reference numbers or codes

OUTPUT FORMAT

Start with a brief metadata summary, then provide the complete Markdown content.

Example:
<!-- Metadata: Document Type = Policy Document, Category = Financial Regulations -->

# [DOC_TITLE] Document Title

## Overview
[Brief description of document purpose]

## Main Section 1
...

IMPORTANT:
- Do NOT skip any text or visual elements
- Do NOT add your own commentary or interpretation
- DO provide enough context for semantic search
- DO structure content to facilitate chunking (clear section breaks)
"""

        if user_query:
            base_prompt += f"""

USER QUERY CONTEXT:
A user has provided this question: "{user_query}"

While extracting all content, pay special attention to information relevant to this query.
Ensure that relevant sections are well-structured and contain enough context to answer the question when retrieved later.
"""

        return base_prompt
