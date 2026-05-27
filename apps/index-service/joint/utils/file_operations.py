from __future__ import annotations

import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from joint.logging import get_logger

logger = get_logger(__name__)


# === File Type Detection ===

def is_doc_file(file_path: str) -> bool:
    """Check if file is a DOC file"""
    return Path(file_path).suffix.lower() == '.doc'


def is_xls_file(file_path: str) -> bool:
    """Check if file is an XLS file"""
    return Path(file_path).suffix.lower() == '.xls'


def is_csv_file(file_path: str) -> bool:
    """Check if file is a CSV file"""
    return Path(file_path).suffix.lower() == '.csv'


def is_excel_file(file_path: str) -> bool:
    """Check if file is an Excel file (xlsx, xls, csv)"""
    excel_extensions = {'.xlsx', '.xls', '.csv'}
    ext = Path(file_path).suffix.lower()
    return ext in excel_extensions


def is_document_file(file_path: str) -> bool:
    """Check if file is a document file (doc, docx, pdf, txt, md)"""
    document_extensions = {
        '.doc', '.docx',
        '.pdf', '.txt', '.md', '.rtf', '.odt',
    }
    ext = Path(file_path).suffix.lower()
    return ext in document_extensions


def is_image_file(file_path: str) -> bool:
    """Check if file is an image file"""
    image_extensions = {
        '.jpg', '.jpeg', '.png',
        '.gif', '.bmp', '.tiff', '.webp', '.svg',
    }
    ext = Path(file_path).suffix.lower()
    return ext in image_extensions


def get_file_category(file_path: str) -> str:
    """
    Categorize file based on extension.

    Args:
        file_path: Path to the file

    Returns:
        File category: 'excel', 'document', 'image', 'other'
    """
    if is_excel_file(file_path):
        return 'excel'
    elif is_document_file(file_path):
        return 'document'
    elif is_image_file(file_path):
        return 'image'
    else:
        return 'other'


# === File Content Type Detection ===

def detect_content_type(file_path: str) -> str:
    """
    Detect MIME content type from file extension.

    Args:
        file_path: Path to the file

    Returns:
        MIME content type string
    """
    content_types = {
        '.txt': 'text/plain',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.md': 'text/markdown',
        '.csv': 'text/csv',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.rtf': 'application/rtf',
        '.odt': 'application/vnd.oasis.opendocument.text',
        '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.ppt': 'application/vnd.ms-powerpoint',
    }

    ext = os.path.splitext(file_path.lower())[1]
    return content_types.get(ext, 'application/octet-stream')


# === File Conversion ===

def convert_doc_to_docx(doc_path: str, output_dir: Optional[str] = None) -> str:
    """
    Convert DOC file to DOCX using LibreOffice

    Args:
        doc_path: Path to the input DOC file
        output_dir: Optional output directory (if None, uses temp directory)

    Returns:
        Path to the converted DOCX file

    Raises:
        RuntimeError: If conversion fails
    """
    try:
        doc_file = Path(doc_path)
        if not doc_file.exists():
            raise FileNotFoundError(f"DOC file not found: {doc_path}")

        # Use provided output directory or create temp directory
        if output_dir is None:
            output_dir = tempfile.mkdtemp()

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Run LibreOffice conversion
        cmd = [
            'libreoffice',
            '--headless',
            '--convert-to', 'docx',
            '--outdir', str(output_path),
            str(doc_file),
        ]

        logger.info(f"Converting DOC to DOCX: {doc_path}")
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"LibreOffice conversion failed: {result.stderr}",
            )

        # Find the converted DOCX file
        docx_filename = doc_file.stem + '.docx'
        docx_path = output_path / docx_filename

        if not docx_path.exists():
            raise RuntimeError(f"Converted DOCX file not found: {docx_path}")

        logger.info(f"Successfully converted DOC to DOCX: {docx_path}")
        return str(docx_path)

    except subprocess.TimeoutExpired:
        raise RuntimeError('LibreOffice conversion timed out')
    except Exception as e:
        logger.error(f"Error converting DOC to DOCX: {str(e)}")
        raise RuntimeError(f"DOC to DOCX conversion failed: {str(e)}")


# === File Cleanup ===

def cleanup_converted_file(file_path: str) -> None:
    """
    Safely cleanup a converted file

    Args:
        file_path: Path to the file to cleanup
    """
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up converted file: {file_path}")
    except Exception as e:
        logger.warning(
            f"Failed to cleanup converted file {file_path}: {str(e)}",
        )


# === File Naming ===

def generate_unique_filename(original_name: str, prefix: str = '', suffix: str = '') -> str:
    """
    Generate a unique filename with optional prefix and suffix.

    Args:
        original_name: Original filename
        prefix: Prefix to add
        suffix: Suffix to add before extension

    Returns:
        Unique filename string
    """
    path = Path(original_name)
    name = path.stem
    ext = path.suffix

    unique_id = str(uuid.uuid4())[:8]

    parts = []
    if prefix:
        parts.append(prefix)
    parts.append(name)
    if suffix:
        parts.append(suffix)
    parts.append(unique_id)

    return '_'.join(parts) + ext


# === File Validation ===

def validate_file_size(file_path: str, max_size_mb: int = 100) -> tuple[bool, str]:
    """
    Validate file size.

    Args:
        file_path: Path to the file
        max_size_mb: Maximum size in MB

    Returns:
        (is_valid, error_message)
    """
    try:
        if not os.path.exists(file_path):
            return False, 'File does not exist'

        file_size = os.path.getsize(file_path)
        max_size_bytes = max_size_mb * 1024 * 1024

        if file_size > max_size_bytes:
            actual_size_mb = file_size / (1024 * 1024)
            return False, f"File size ({actual_size_mb:.1f}MB) exceeds maximum allowed size ({max_size_mb}MB)"

        return True, ''
    except Exception as e:
        return False, f"Error validating file size: {str(e)}"


# === Document Processing Utils ===

def get_recommended_processing_type(file_path: str) -> str:
    """
    Get recommended document processing type based on file extension.

    Args:
        file_path: Path to the file

    Returns:
        Recommended processing type string
    """
    excel_extensions = {'.xlsx', '.xls', '.csv'}
    ext = os.path.splitext(file_path.lower())[1]

    if ext in excel_extensions:
        return 'excel'
    else:
        return 'document_structured_llm'


def parse_datetime_string(date_str: str | None) -> datetime | None:
    """
    Convert string datetime to datetime object with multiple format support.

    Args:
        date_str: Date string to parse

    Returns:
        datetime object or None if parsing fails or input is None
    """
    if date_str is None:
        return None
    try:
        # Try common datetime formats
        formats = [
            '%Y-%m-%d',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # If no format matches, try ISO format
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except Exception as e:
        logger.warning(f"Failed to parse datetime '{date_str}': {e}")
        return None
