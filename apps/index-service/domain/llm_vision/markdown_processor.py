from __future__ import annotations

import re
from typing import Dict
from typing import Optional

from joint.logging.logger import get_logger

logger = get_logger(__name__)


class MarkdownImageProcessor:
    """
    Utility for processing image references in markdown text.

    DEPRECATED: This class is kept for backward compatibility only.
    New implementation directly replaces images with URLs and descriptions in parsers.
    """

    @staticmethod
    def replace_image_urls_and_descriptions(
        markdown_text: str,
        image_url_mapping: Dict[str, str],
        image_descriptions: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Legacy method: Replace local image references with MinIO public URLs and enhanced descriptions.

        DEPRECATED: Use parser's built-in image processing instead.
        Kept for backward compatibility with old code.

        Args:
            markdown_text: Original markdown text with local image references
            image_url_mapping: Mapping of image keys to public URLs
            image_descriptions: Mapping of image keys to AI-generated descriptions (optional)

        Returns:
            str: Markdown text with public image URLs and enhanced alt text
        """

        logger.warning(
            'Using deprecated MarkdownImageProcessor.replace_image_urls_and_descriptions()',
        )
        logger.warning(
            "Consider using parser's built-in image processing for better performance",
        )

        # Handle case where descriptions are not provided
        if image_descriptions is None:
            image_descriptions = {}

        logger.info(f"Processing {len(image_url_mapping)} images")

        # Find all image references in markdown
        image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        matches = re.findall(image_pattern, markdown_text)
        logger.info(f"Found {len(matches)} image references in markdown")

        # Get list of public URLs in order
        public_urls = list(image_url_mapping.values())
        unique_urls = []
        for url in public_urls:
            if url not in unique_urls:
                unique_urls.append(url)

        # Replace each image reference with corresponding public URL and enhanced description
        for i, (alt_text, image_path) in enumerate(matches):
            if i < len(unique_urls):
                public_url = unique_urls[i]
                image_key = f"image_{i}"

                # Get AI-generated description or fallback to original alt text
                enhanced_description = image_descriptions.get(
                    image_key, alt_text,
                )
                if not enhanced_description:
                    enhanced_description = alt_text if alt_text else f"Image {i + 1}"

                # Replace this specific image reference with enhanced alt text
                old_pattern = rf'!\[{re.escape(alt_text)}\]\({re.escape(image_path)}\)'
                new_replacement = f'![{enhanced_description}]({public_url})'

                # Only replace the first occurrence to maintain order
                markdown_text = re.sub(
                    old_pattern, new_replacement, markdown_text, count=1,
                )
            else:
                logger.warning(
                    f"No public URL available for image {i}: {image_path}",
                )

        return markdown_text
