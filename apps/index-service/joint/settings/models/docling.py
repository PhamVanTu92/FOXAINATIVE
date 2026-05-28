from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class ConverterSettings(BaseModel):
    images_scale: float = Field(
        1.0,
        description='Scale factor for images.',
    )
    generate_page_images: bool = Field(
        True,
        description='Whether to generate images for each page.',
    )
    generate_picture_images: bool = Field(
        True,
        description='Whether to generate images for each picture.',
    )
    do_code_enrichment: bool = Field(
        True,
        description='Whether to enrich code snippets.',
    )


class ChunkerSettings(BaseModel):
    max_tokens: int = Field(
        500,
        description='Maximum number of tokens per chunk.',
    )
    tokenizer: str = Field(
        'your_tokenizer',
        description='Tokenizer to use for chunking.',
    )
