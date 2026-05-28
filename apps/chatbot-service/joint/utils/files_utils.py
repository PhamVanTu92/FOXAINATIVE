from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from joint.logging import get_logger

logger = get_logger(__name__)


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


def is_doc_file(file_path: str) -> bool:
    """Check if file is a DOC file"""
    return Path(file_path).suffix.lower() == '.doc'


def is_xls_file(file_path: str) -> bool:
    """Check if file is an XLS file"""
    return Path(file_path).suffix.lower() == '.xls'


def is_csv_file(file_path: str) -> bool:
    """Check if file is a CSV file"""
    return Path(file_path).suffix.lower() == '.csv'
