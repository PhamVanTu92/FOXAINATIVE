"""
Hierarchical Markdown Chunker with Document Title Persistence and Breadcrumbs.

This chunker processes markdown documents with hierarchical structure tracking,
preserving document title globally and building breadcrumb paths for each chunk.
Supports page range tracking and semantic sentence-based splitting with table awareness.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from typing import Set
from typing import Tuple

from joint.logging.logger import get_logger

logger = get_logger(__name__)

# Table-specific thresholds (independent from chunk_size for text content)
TABLE_SIZE_THRESHOLD = 3500  # Max size for intact table (~1 page A4)
TABLE_CHUNK_SIZE = 2500      # Target size per sub-table when splitting large tables


@dataclass
class TableBlock:
    """Represents a markdown table with its components."""
    start_idx: int
    end_idx: int
    title: Optional[str]
    header_rows: List[str]
    data_rows: List[str]
    total_chars: int

    def is_large(self) -> bool:
        """Check if table exceeds size threshold (~1 page A4)."""
        return self.total_chars > TABLE_SIZE_THRESHOLD


class HierarchicalMarkdownChunk:
    """Represents a markdown chunk with hierarchical context and page range."""

    def __init__(
        self,
        text: str,
        pages: List[int],
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.text = text
        self.pages = pages
        self.metadata = metadata or {}

    def __str__(self):
        return self.text

    def __repr__(self):
        return f"HierarchicalMarkdownChunk(pages={self.pages}, text='{self.text[:50]}...', metadata={self.metadata})"


class HierarchicalMarkdownChunker:
    """
    Chunker for hierarchical markdown documents with document title persistence.

    Features:
    - Detects and persists document title ([DOC_TITLE] marker)
    - Builds breadcrumb hierarchy for each chunk
    - Tracks page ranges for content
    - Semantic sentence-based splitting with overlap
    - Maintains header stack for context
    """

    def __init__(
        self,
        chunk_size: int = 700,
        chunk_overlap: int = 200,
        **kwargs,
    ):
        """
        Initialize the HierarchicalMarkdownChunker.

        Args:
            chunk_size: Target size of each chunk in characters
            chunk_overlap: Number of characters to overlap between chunks
            **kwargs: Additional arguments (for compatibility)
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        # Regex patterns
        self.header_pattern = re.compile(r'^(#{1,6})\s+(.+)$')
        self.page_marker_pattern = re.compile(r'^<!-- PAGE: (\d+) -->$')
        self.doc_title_pattern = re.compile(r'\[DOC_TITLE\]')

        logger.info(
            f"HierarchicalMarkdownChunker initialized: "
            f"chunk_size={chunk_size}, chunk_overlap={chunk_overlap}",
        )

    def chunk_markdown(self, markdown_text: str) -> List[HierarchicalMarkdownChunk]:
        """
        Chunk markdown text with hierarchical structure tracking.

        Args:
            markdown_text: The markdown text to chunk

        Returns:
            List of HierarchicalMarkdownChunk objects with full context
        """
        if not markdown_text or not markdown_text.strip():
            logger.warning('Empty markdown text provided')
            return []

        logger.info(f"Chunking markdown text: {len(markdown_text)} characters")

        chunks = []
        header_stack: List[Tuple[int, str]] = []
        current_content: List[str] = []
        current_pages: Set[int] = set()
        current_page = 1
        persistent_doc_title = None

        lines = markdown_text.split('\n')

        def flush_content():
            nonlocal current_content, current_pages, persistent_doc_title
            if not current_content:
                return

            raw_text = '\n'.join(current_content).strip()
            current_content = []

            if not raw_text:
                current_pages = set()
                return

            # Build full title: document_title + header_stack
            stack_titles = [h[1] for h in header_stack]
            if persistent_doc_title:
                full_title_parts = [persistent_doc_title] + stack_titles
            else:
                full_title_parts = stack_titles

            if full_title_parts:
                full_title = ' - '.join(full_title_parts)
            else:
                full_title = 'General'

            # Calculate page list
            if not current_pages:
                page_list = [current_page]
            else:
                page_list = sorted(list(current_pages))

            # Build simplified metadata (pages already in .pages attribute)
            base_metadata = {
                'section_heading': full_title,  # Full hierarchical title
            }

            # Apply table-aware semantic splitting
            sub_chunks = self._chunk_content_with_tables(raw_text)

            for chunk_idx, sub_chunk_text in enumerate(sub_chunks):
                chunk_metadata = base_metadata.copy()
                chunk_metadata['chunk_index'] = chunk_idx
                chunk_metadata['chunk_strategy'] = 'hierarchical_semantic'

                chunks.append(
                    HierarchicalMarkdownChunk(
                        text=sub_chunk_text,
                        pages=page_list,
                        metadata=chunk_metadata,
                    ),
                )

            # Reset pages for next section
            current_pages = {current_page}

        # Parse markdown line by line
        for line in lines:
            stripped = line.strip()

            # Check for page marker
            page_match = self.page_marker_pattern.match(stripped)
            if page_match:
                current_page = int(page_match.group(1))
                current_pages.add(current_page)
                continue

            # Check for header
            header_match = self.header_pattern.match(stripped)
            if header_match:
                flush_content()

                level = len(header_match.group(1))
                title = header_match.group(2).strip()

                # Check for [DOC_TITLE] marker
                if self.doc_title_pattern.search(title):
                    persistent_doc_title = self.doc_title_pattern.sub(
                        '', title,
                    ).strip()
                    logger.info(
                        f"Detected document title: {persistent_doc_title}",
                    )
                    continue

                # Update header stack
                while header_stack and header_stack[-1][0] >= level:
                    header_stack.pop()

                header_stack.append((level, title))
                current_pages.add(current_page)
            else:
                # Regular content
                current_content.append(line.rstrip())
                current_pages.add(current_page)

        # Flush remaining content
        flush_content()

        logger.info(f"Created {len(chunks)} hierarchical chunks from markdown")
        return chunks

    def _detect_markdown_tables(self, lines: List[str]) -> List[TableBlock]:
        """
        Detect all markdown tables in content lines.
        Returns list of TableBlock with metadata.
        """
        tables = []
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # Check if this line starts a table
            if line.startswith('|') and '|' in line[1:]:
                table_start = i
                table_lines = []

                # Collect all consecutive table lines
                while i < len(lines) and lines[i].strip().startswith('|'):
                    table_lines.append(lines[i])
                    i += 1

                # Must have at least 2 rows (header + separator)
                if len(table_lines) >= 2:
                    # Parse table components
                    header_rows = []
                    data_rows = []
                    separator_found = False

                    for tline in table_lines:
                        # Check if separator row (contains only |, :, -, and spaces)
                        if re.match(r'^\s*\|[\s\-:|]+\|\s*$', tline):
                            separator_found = True
                            header_rows.append(tline)
                        elif not separator_found:
                            header_rows.append(tline)
                        else:
                            data_rows.append(tline)

                    # Extract title (look back 1-3 lines for heading or text)
                    title = None
                    for lookback in range(1, 4):
                        title_idx = table_start - lookback
                        if title_idx >= 0:
                            title_line = lines[title_idx].strip()
                            # Check if it's a heading or substantial text
                            if title_line.startswith('#') or (title_line and not title_line.startswith('|')):
                                title = title_line
                                break

                    total_chars = sum(len(line) for line in table_lines)

                    tables.append(
                        TableBlock(
                            start_idx=table_start,
                            end_idx=i - 1,
                            title=title,
                            header_rows=header_rows,
                            data_rows=data_rows,
                            total_chars=total_chars,
                        ),
                    )
                continue
            i += 1

        return tables

    def _split_large_table(self, table: TableBlock) -> List[str]:
        """
        Split large table into multiple sub-tables, preserving header.
        Each sub-table includes title + headers + subset of data rows.
        Uses TABLE_CHUNK_SIZE threshold, not user's chunk_size parameter.
        """
        if not table.is_large():
            # Return as single block
            result = []
            if table.title:
                result.append(table.title)
            result.extend(table.header_rows)
            result.extend(table.data_rows)
            return ['\n'.join(result)]

        # Calculate overhead for each chunk
        title_size = len(table.title) if table.title else 0
        header_size = sum(len(h) for h in table.header_rows)
        overhead = title_size + header_size + 200  # buffer

        available_size = TABLE_CHUNK_SIZE - overhead

        sub_tables = []
        current_rows: List[str] = []
        current_size = 0
        is_continuation = False

        for row in table.data_rows:
            row_size = len(row)

            if current_size + row_size > available_size and current_rows:
                # Flush current sub-table
                result = []
                if table.title:
                    title_text = table.title
                    if is_continuation:
                        # Add continuation marker
                        title_text = title_text.rstrip() + ' (continued)'
                    result.append(title_text)
                result.extend(table.header_rows)
                result.extend(current_rows)

                sub_tables.append('\n'.join(result))

                current_rows = []
                current_size = 0
                is_continuation = True

            current_rows.append(row)
            current_size += row_size

        # Last sub-table
        if current_rows:
            result = []
            if table.title:
                title_text = table.title
                if is_continuation:
                    title_text = title_text.rstrip() + ' (continued)'
                result.append(title_text)
            result.extend(table.header_rows)
            result.extend(current_rows)
            sub_tables.append('\n'.join(result))

        return sub_tables

    def _chunk_content_with_tables(self, content: str) -> List[str]:
        """
        Table-aware content chunking. Preserves small tables intact, splits large tables.
        Falls back to semantic chunking for non-table content.
        """
        lines = content.split('\n')
        tables = self._detect_markdown_tables(lines)

        # If no tables, use original semantic chunking
        if not tables:
            return self._chunk_content_semantically(content)

        # Process content with table awareness
        chunks = []
        current_pos = 0

        for table in tables:
            # Add content before table (if any)
            if table.start_idx > current_pos:
                pre_table_lines = lines[current_pos:table.start_idx]
                pre_table_text = '\n'.join(pre_table_lines).strip()
                if pre_table_text:
                    # Apply semantic chunking to pre-table text
                    pre_chunks = self._chunk_content_semantically(
                        pre_table_text,
                    )
                    chunks.extend(pre_chunks)

            # Process table (uses table-specific thresholds, not chunk_size)
            if table.is_large():
                table_chunks = self._split_large_table(table)
                chunks.extend(table_chunks)
            else:
                # Keep small table intact
                table_lines = []
                if table.title:
                    table_lines.append(table.title)
                table_lines.extend(table.header_rows)
                table_lines.extend(table.data_rows)
                chunks.append('\n'.join(table_lines))

            current_pos = table.end_idx + 1

        # Add remaining content after last table
        if current_pos < len(lines):
            post_table_lines = lines[current_pos:]
            post_table_text = '\n'.join(post_table_lines).strip()
            if post_table_text:
                post_chunks = self._chunk_content_semantically(post_table_text)
                chunks.extend(post_chunks)

        return chunks if chunks else [content]

    def _chunk_content_semantically(self, content: str) -> List[str]:
        """
        Split content into chunks that respect chunk_size, breaking at sentence boundaries.
        Includes overlap between chunks.

        Args:
            content: Text content to split

        Returns:
            List of chunk strings
        """
        if len(content) <= self.chunk_size:
            return [content]

        sentences = self._split_sentences(content)
        chunks = []
        current_chunk_sentences: List[str] = []
        current_char_count = 0

        i = 0
        while i < len(sentences):
            sentence = sentences[i]
            sent_len = len(sentence)

            # If adding this sentence exceeds chunk_size
            if current_char_count + sent_len > self.chunk_size and current_chunk_sentences:
                # Finalize current chunk
                chunks.append(' '.join(current_chunk_sentences))

                # Backtrack to create overlap
                backtrack_chars = 0
                overlap_start_index = i

                # Walk backwards to get overlap
                for j in range(i - 1, -1, -1):
                    prev_sent_len = len(sentences[j])
                    backtrack_chars += prev_sent_len

                    if backtrack_chars >= self.chunk_overlap:
                        overlap_start_index = j
                        break
                    overlap_start_index = j

                # Ensure forward progress
                start_index_of_current_chunk = i - len(current_chunk_sentences)
                if overlap_start_index <= start_index_of_current_chunk:
                    overlap_start_index = start_index_of_current_chunk + 1

                if overlap_start_index >= i:
                    overlap_start_index = i

                # Reset with overlap
                i = overlap_start_index
                current_chunk_sentences = []
                current_char_count = 0
                continue

            current_chunk_sentences.append(sentence)
            current_char_count += sent_len
            i += 1

        if current_chunk_sentences:
            chunks.append(' '.join(current_chunk_sentences))

        return chunks

    def _split_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences using regex heuristics.

        Args:
            text: Text to split

        Returns:
            List of sentences
        """
        # Pattern: End of sentence punctuation followed by space or end of string
        # Avoid splitting on numbered lists (e.g., "1. Item")
        sentences = re.split(
            r'(?:(?<=[!?])|(?<=[^0-9]\.))\s+',
            text,
        )
        return [s.strip() for s in sentences if s.strip()]
