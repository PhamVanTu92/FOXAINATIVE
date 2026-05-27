from __future__ import annotations

from .async_helpers import close_shared_http_client
from .async_helpers import get_shared_http_client
from .document_detection import DocumentDetectionService
from .file_operations import cleanup_converted_file
from .file_operations import convert_doc_to_docx
from .file_operations import detect_content_type
from .file_operations import generate_unique_filename
from .file_operations import get_file_category
from .file_operations import get_recommended_processing_type
from .file_operations import is_csv_file
from .file_operations import is_doc_file
from .file_operations import is_document_file
from .file_operations import is_excel_file
from .file_operations import is_image_file
from .file_operations import is_xls_file
from .file_operations import parse_datetime_string
from .file_operations import validate_file_size
from .get_settings import get_settings
from .get_time import get_vietnam_time
from .time_measure import measure_time
from .validation_utils import normalize_phone
from .validation_utils import validate_and_fix_url
from .validation_utils import validate_datetime_string
from .validation_utils import validate_email
from .validation_utils import validate_vietnam_phone
# File operations - All file-related utilities
# Validation utilities
# System utilities


__all__ = [
    # File operations
    'is_doc_file',
    'is_xls_file',
    'is_csv_file',
    'is_excel_file',
    'is_document_file',
    'is_image_file',
    'get_file_category',
    'detect_content_type',
    'convert_doc_to_docx',
    'cleanup_converted_file',
    'generate_unique_filename',
    'validate_file_size',
    'get_recommended_processing_type',
    'parse_datetime_string',
    # Validation
    'validate_email',
    'validate_vietnam_phone',
    'normalize_phone',
    'validate_and_fix_url',
    'validate_datetime_string',
    # System
    'get_settings',
    'get_vietnam_time',
    'measure_time',
    'DocumentDetectionService',
    # Async helpers
    'get_shared_http_client',
    'close_shared_http_client',
]
