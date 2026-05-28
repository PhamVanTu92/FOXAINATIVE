from __future__ import annotations

import fitz  # PyMuPDF
from joint.logging.logger import get_logger

logger = get_logger(__name__)


class DocumentDetectionService:
    """Service to detect if PDF is scanned or not"""

    def detect_pdf_type(self, file_path: str) -> str:
        """
        Detect if PDF is scanned or text-based
        Returns: 'scan' or 'text'
        """
        try:
            doc = fitz.open(file_path)
            total_chars = 0
            total_images = 0
            total_fonts = 0
            page_count = len(doc)

            # Analyze first few pages (max 5 for performance)
            pages_to_check = min(5, page_count)

            for page_num in range(pages_to_check):
                page = doc[page_num]

                # Count text characters
                text = page.get_text()
                total_chars += len(text.strip())

                # Count images
                images = page.get_images()
                total_images += len(images)

                # Count fonts
                fonts = page.get_fonts()
                total_fonts += len(fonts)

            doc.close()

            # Calculate metrics
            avg_chars_per_page = total_chars / pages_to_check if pages_to_check > 0 else 0
            avg_images_per_page = total_images / pages_to_check if pages_to_check > 0 else 0
            avg_fonts_per_page = total_fonts / pages_to_check if pages_to_check > 0 else 0

            # Decision logic (hybrid approach)
            score = 0

            # Text content check
            if avg_chars_per_page < 100:  # Very little text
                score += 3
            elif avg_chars_per_page < 500:  # Some text but limited
                score += 1

            # Image density check
            if avg_images_per_page > 0.8:  # High image density
                score += 2

            # Font check
            if avg_fonts_per_page < 2:  # Very few fonts
                score += 1

            # Determine result
            pdf_type = 'scan' if score >= 3 else 'text'

            logger.info(
                f"PDF analysis: {avg_chars_per_page:.0f} chars/page, "
                f"{avg_images_per_page:.1f} images/page, "
                f"{avg_fonts_per_page:.1f} fonts/page, "
                f"score: {score}, type: {pdf_type}",
            )

            return pdf_type

        except Exception as e:
            logger.error(f"Error detecting PDF type: {e}")
            # Default to scan if detection fails
            return 'scan'
