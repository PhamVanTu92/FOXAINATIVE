from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from typing import Dict
from typing import List
from typing import Optional

import pandas as pd
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger

logger = get_logger(__name__)


class ExcelQALoaderInput(BaseModel):
    path: str
    sheet_name: Optional[str] = None  # If None, will process all sheets
    # If True, process all sheets regardless of sheet_name
    process_all_sheets: bool = False


class ExcelQALoaderOutput(BaseModel):
    chunks: List[Dict[str, Any]]


class ExcelQALoaderService(BaseService):
    """
    Service to convert Excel/CSV data into chunks/objects
    with dynamic headers from first row.
    """

    def _normalize_cell_value(self, value: Any) -> Optional[str]:
        """Normalize cell value: trim, keep line breaks"""
        if pd.isna(value) or value is None or value == '':
            return None

        # Convert to string and trim
        str_value = str(value).strip()

        # If empty after trim, return None
        if not str_value:
            return None

        return str_value

    def _handle_duplicate_headers(self, headers: List[str]) -> List[str]:
        """Handle duplicate headers by adding suffix _1, _2"""
        seen: Dict[str, int] = {}
        result = []

        for header in headers:
            if header in seen:
                seen[header] += 1
                result.append(f"{header}_{seen[header]}")
            else:
                seen[header] = 0
                result.append(header)

        return result

    def _find_header_row(self, df: pd.DataFrame) -> Optional[int]:
        """Find first row with at least one non-empty cell as header"""
        for idx, row in df.iterrows():
            if row.notna().any():  # Has at least one non-empty cell
                return idx
        return None

    def _extract_headers(self, df: pd.DataFrame, header_row_idx: int) -> List[str]:
        """Extract headers from specified row"""
        header_row = df.iloc[header_row_idx]
        headers: List[str] = []

        for value in header_row:
            normalized = self._normalize_cell_value(value)
            if normalized is None:
                # Default name for empty column
                headers.append(f"column_{len(headers) + 1}")
            else:
                headers.append(normalized)

        # Handle duplicate headers
        return self._handle_duplicate_headers(headers)

    def _create_chunk(
        self, row_data: pd.Series, headers: List[str],
        row_index: int, source: str, sheet_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a chunk from row data"""

        # Create data object mapping header -> cell_value
        data = {}
        for i, (header, value) in enumerate(zip(headers, row_data)):
            normalized_value = self._normalize_cell_value(value)
            data[header] = normalized_value

        # Create page_content
        page_content_parts = []
        for header, value in data.items():
            if value is not None:
                page_content_parts.append(f"{header}: {value}")
        page_content = '\n'.join(page_content_parts)

        # Create unique ID with sheet name if available
        chunk_id = f"row_{row_index}"
        if sheet_name:
            chunk_id = f"{sheet_name}_row_{row_index}"

        # Create chunk
        chunk = {
            'id': chunk_id,
            'data': data,
            'page_content': page_content,
            'metadata': {
                'source': source,
                'row_index': row_index,
                'headers': headers,
                'sheet_name': sheet_name,
            },
        }

        return chunk

    def _process_single_sheet(self, file_path: str, sheet_name_or_index, source: str) -> List[Dict[str, Any]]:
        """Process a single sheet from Excel file"""
        try:
            # Read Excel sheet
            df = pd.read_excel(
                file_path, sheet_name=sheet_name_or_index, header=None,
            )

            # Get actual sheet name
            actual_sheet_name = sheet_name_or_index if isinstance(
                sheet_name_or_index, str,
            ) else f"Sheet_{sheet_name_or_index + 1}"

            # Find header row
            header_row_idx = self._find_header_row(df)
            if header_row_idx is None:
                logger.warning(
                    f"No valid header row found in sheet: {actual_sheet_name}",
                )
                return []

            # Extract headers
            headers = self._extract_headers(df, header_row_idx)
            logger.info(
                f"Found headers in sheet '{actual_sheet_name}': {headers}",
            )

            # Process data rows
            chunks = []

            for idx in range(header_row_idx + 1, len(df)):
                row = df.iloc[idx]

                # Check for completely empty row
                if row.isna().all():
                    break  # Stop when encountering completely empty row

                # Create chunk for this row
                chunk = self._create_chunk(
                    row, headers, idx + 1, source, actual_sheet_name,
                )
                chunks.append(chunk)

            logger.info(
                f"Created {len(chunks)} chunks from sheet '{actual_sheet_name}'",
            )
            return chunks

        except Exception as e:
            logger.error(
                f"Error processing sheet '{sheet_name_or_index}': {e}",
            )
            return []

    def _process_excel_file(self, file_path: str, sheet_name: Optional[str] = None, process_all_sheets: bool = False) -> List[Dict[str, Any]]:
        """Process Excel file"""
        try:
            source = Path(file_path).name
            all_chunks = []

            if process_all_sheets or (sheet_name is None and not process_all_sheets):
                # Get all sheet names
                try:
                    excel_file = pd.ExcelFile(file_path)
                    sheet_names = excel_file.sheet_names
                    logger.info(
                        f"Found {len(sheet_names)} sheets: {sheet_names}",
                    )

                    if process_all_sheets:
                        # Process all sheets
                        for sheet_name_iter in sheet_names:
                            logger.info(f"Processing sheet: {sheet_name_iter}")
                            chunks = self._process_single_sheet(
                                file_path, sheet_name_iter, source,
                            )
                            all_chunks.extend(chunks)
                    else:
                        # Process only first sheet (default behavior when sheet_name is None)
                        if sheet_names:
                            logger.info(
                                f"Processing first sheet: {sheet_names[0]}",
                            )
                            chunks = self._process_single_sheet(
                                file_path, sheet_names[0], source,
                            )
                            all_chunks.extend(chunks)

                except Exception as e:
                    logger.error(f"Error getting sheet names: {e}")
                    # Fallback to reading first sheet by index
                    chunks = self._process_single_sheet(file_path, 0, source)
                    all_chunks.extend(chunks)
            else:
                # Process specific sheet
                logger.info(f"Processing specific sheet: {sheet_name}")
                chunks = self._process_single_sheet(
                    file_path, sheet_name, source,
                )
                all_chunks.extend(chunks)

            logger.info(
                f"Total created {len(all_chunks)} chunks from Excel file",
            )
            return all_chunks

        except Exception as e:
            logger.error(f"Error processing Excel file: {e}")
            raise

    def _process_csv_file(self, file_path: str) -> List[Dict[str, Any]]:
        """Process CSV file"""
        try:
            # Try common encodings
            encodings = ['utf-8', 'utf-8-sig', 'latin1', 'cp1252']
            df = None

            for encoding in encodings:
                try:
                    df = pd.read_csv(file_path, header=None, encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue

            if df is None:
                raise ValueError(
                    'Cannot read CSV file with attempted encodings',
                )

            # Process similar to Excel
            header_row_idx = self._find_header_row(df)
            if header_row_idx is None:
                logger.warning('No valid header row found')
                return []

            headers = self._extract_headers(df, header_row_idx)

            chunks = []
            source = Path(file_path).name

            for idx in range(header_row_idx + 1, len(df)):
                row = df.iloc[idx]

                if row.isna().all():
                    break

                chunk = self._create_chunk(row, headers, idx + 1, source, None)
                chunks.append(chunk)

            logger.info(f"Created {len(chunks)} chunks from CSV file")
            return chunks

        except Exception as e:
            logger.error(f"Error processing CSV file: {e}")
            raise

    async def process(self, inputs: ExcelQALoaderInput) -> ExcelQALoaderOutput:
        """
        Process input to convert Excel/CSV to chunks
        """
        file_path = Path(inputs.path)

        if not file_path.exists():
            raise FileNotFoundError(f"File does not exist: {file_path}")

        logger.info(f"Processing file: {file_path}")

        # Determine file type and process accordingly
        file_extension = file_path.suffix.lower()

        if file_extension in ['.xlsx', '.xls']:
            chunks = self._process_excel_file(
                str(file_path), inputs.sheet_name, inputs.process_all_sheets,
            )
        elif file_extension in ['.csv']:
            chunks = self._process_csv_file(str(file_path))
        else:
            raise ValueError(
                f"Unsupported file format: {file_extension}. Only supports .xlsx, .xls, .csv",
            )

        return ExcelQALoaderOutput(chunks=chunks)

    def process_and_export_json(self, inputs: ExcelQALoaderInput, output_path: Optional[str] = None) -> str:
        """
        Process and export result to JSON file
        """
        import asyncio

        # Run async process
        result = asyncio.run(self.process(inputs))

        # Convert to JSON
        json_output = json.dumps(result.chunks, ensure_ascii=False, indent=2)

        # Save file if output_path provided
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(json_output)
            logger.info(f"Exported result to file: {output_path}")

        return json_output


# Utility function for direct use
def excel_to_chunks(
    file_path: str, sheet_name: Optional[str] = None,
    process_all_sheets: bool = False,
    output_json_path: Optional[str] = None,
) -> str:
    """
    Utility function to convert Excel/CSV to chunks JSON

    Args:
        file_path: Path to file
        sheet_name: Sheet name (for Excel only)
        process_all_sheets: If True, process all sheets in Excel file
        output_json_path: JSON output file path (optional)

    Returns:
        str: JSON string containing chunks
    """
    service = ExcelQALoaderService()
    inputs = ExcelQALoaderInput(
        path=file_path,
        sheet_name=sheet_name,
        process_all_sheets=process_all_sheets,
    )

    return service.process_and_export_json(inputs, output_json_path)


if __name__ == '__main__':
    # Usage examples
    file_path = '/path/to/your/excel_file.xlsx'

    try:
        print('=== Example 1: Process only first sheet ===')
        json_result = excel_to_chunks(
            file_path, output_json_path='output_first_sheet.json',
        )
        print('First sheet processed successfully')

        print('\n=== Example 2: Process specific sheet ===')
        json_result = excel_to_chunks(
            file_path, sheet_name='Sheet2', output_json_path='output_sheet2.json',
        )
        print('Specific sheet processed successfully')

        print('\n=== Example 3: Process all sheets ===')
        json_result = excel_to_chunks(
            file_path, process_all_sheets=True, output_json_path='output_all_sheets.json',
        )
        print('All sheets processed successfully')
        print('JSON Result sample:')
        print(
            json_result[:500] + '...' if len(json_result)
            > 500 else json_result,
        )

    except Exception as e:
        print(f"Error: {e}")
