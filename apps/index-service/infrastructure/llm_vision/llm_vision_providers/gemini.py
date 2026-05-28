from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any
from typing import Optional
from typing import Type

from google import genai
from google.genai import types
from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import GeminiSettings

from .base import BaseLLMVisionProvider
from .base import LLMVisionInput
from .base import LLMVisionOutput
from .base import LLMVisionProviderType

logger = get_logger(__name__)

# MIME type mapping for supported file formats
MIME_TYPE_MAPPING = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
}

# Module-level singleton
_client: Optional[genai.Client] = None
_client_api_key: Optional[str] = None


class GeminiVisionProvider(BaseLLMVisionProvider, BaseModel):
    """Gemini Vision LLM provider with module-level singleton client."""

    settings: GeminiSettings

    @property
    def provider_type(self) -> LLMVisionProviderType:
        return LLMVisionProviderType.GEMINI_VISION

    @property
    def client(self) -> genai.Client:
        """Get singleton Gemini client."""
        global _client, _client_api_key

        if _client is None or _client_api_key != self.settings.api_key:
            logger.info('Initializing Gemini Vision client')
            _client = genai.Client(api_key=self.settings.api_key)
            _client_api_key = self.settings.api_key
            logger.info('Gemini Vision client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client, _client_api_key
        if _client is not None:
            logger.info('Resetting Gemini Vision client')
            _client = None
            _client_api_key = None

    def with_structured_output(self, schema: Type[Any]) -> GeminiVisionProvider:
        """Configure structured output schema."""
        self._structured_output_schema = schema
        return self

    async def process(self, input: LLMVisionInput) -> LLMVisionOutput:
        """Analyze file using Gemini with file upload - runs in thread pool to avoid blocking."""
        try:
            if not input.file_path:
                raise ValueError('file_path is required')

            # Run the blocking Gemini operations in a thread pool
            return await asyncio.to_thread(self._process_sync, input)

        except Exception as e:
            logger.error(f"Gemini error: {e}")

            # Check for specific error types and raise appropriate exceptions
            error_str = str(e).lower()
            if 'document has no pages' in error_str:
                raise ValueError(
                    'Invalid or corrupted PDF file: The document has no pages. Please check the file format and content.',
                )
            elif 'invalid_argument' in error_str:
                raise ValueError(f"Invalid file format or content: {str(e)}")
            elif 'permission_denied' in error_str:
                raise PermissionError(
                    f"Permission denied accessing Gemini API: {str(e)}",
                )
            elif 'failed_precondition' in error_str or 'not in an active' in error_str:
                # Provide clearer troubleshooting guidance for file activation issues
                raise RuntimeError(
                    f"Gemini file activation error: {str(e)}. This usually means the uploaded file is not yet ACTIVE or your account does not allow file usage. "
                    'Check your Gemini/GenAI console for uploaded file status, ensure the API key has permissions, and that you have sufficient quota. '
                    'The SDK will retry automatically, but persistent failures require investigation.',
                )
            else:
                raise RuntimeError(f"Gemini processing failed: {str(e)}")

    def _process_sync(self, input: LLMVisionInput) -> LLMVisionOutput:
        """Synchronous processing method - runs in thread pool to avoid blocking event loop."""
        uploaded_file = None
        try:
            client = self.client

            # Determine MIME type from file extension
            file_path = Path(input.file_path or '')
            file_ext = file_path.suffix.lower()
            mime_type = MIME_TYPE_MAPPING.get(file_ext)

            if not mime_type:
                raise ValueError(f"Unsupported file type: {file_ext}")

            # Upload file with explicit MIME type
            logger.info(
                f"Uploading file: {input.file_path} with MIME type: {mime_type}",
            )
            uploaded_file = client.files.upload(
                file=input.file_path, config={'mime_type': mime_type},
            )
            logger.info(
                f"File uploaded: {getattr(uploaded_file, 'uri', uploaded_file)}",
            )

            # Some Gemini file uploads require background processing before they become ACTIVE.
            # Poll the file status for a short time and wait until it's ACTIVE (if available).
            # If the SDK raises when checking status, we fall back to retry-on-generate below.
            file_obj: Optional[Any] = uploaded_file
            max_wait_seconds = 30
            poll_interval = 1
            start_ts = time.time()
            try:
                while time.time() - start_ts < max_wait_seconds:
                    try:
                        # Try to refresh file metadata/status using the SDK
                        file_obj = client.files.get(name=uploaded_file.name)
                    except Exception:
                        # If get is not available or fails, break and rely on generate retry logic
                        logger.debug(
                            'Could not refresh uploaded file status, will rely on retry-on-generate.',
                        )
                        break

                    # inspect common status attributes
                    status = getattr(file_obj, 'state', None) or getattr(
                        file_obj, 'status', None,
                    ) or getattr(file_obj, 'life_cycle_state', None)
                    if status:
                        status_str = str(status).upper()
                        # Only log on first check or state change
                        if 'ACTIVE' in status_str:
                            logger.info(
                                'Uploaded file is ACTIVE, proceeding with generation',
                            )
                            break
                        elif time.time() - start_ts < 2:  # Only log non-ACTIVE in first 2 seconds
                            logger.info(
                                f"Uploaded file status: {status}, waiting...",
                            )

                    time.sleep(poll_interval)
            except Exception as e:
                logger.debug(f"Exception while polling file status: {e}")

            structured_schema = getattr(
                self, '_structured_output_schema', None,
            ) or input.structured_output

            # Determine model name - use full model name for document processing
            model_name = self.settings.model_name_vision
            if not model_name.startswith('models/'):
                model_name = f'models/{model_name}'

            logger.info(f"Using model: {model_name} for file processing")

            # Create content with file
            contents = [
                types.Content(
                    role='user',
                    parts=[
                        types.Part(text=input.prompt),
                        types.Part.from_uri(
                            file_uri=uploaded_file.uri, mime_type=uploaded_file.mime_type,
                        ),
                    ],
                ),
            ]

            # Helper: attempt generate with retries when the file is not yet active
            def _attempt_generate(**kwargs):
                max_attempts = 6
                backoff = 1
                last_error = None
                for attempt in range(1, max_attempts + 1):
                    try:
                        return client.models.generate_content(**kwargs)
                    except Exception as ge:
                        last_error = ge
                        msg = str(ge)
                        # Detect the specific Gemini error indicating file is not active
                        if 'not in an active' in msg.lower() or 'failed_precondition' in msg.lower():
                            if attempt < max_attempts:
                                wait = min(backoff * attempt, 10)
                                logger.warning(
                                    f"Gemini generate_content attempt {attempt}/{max_attempts} failed due to file not ACTIVE; retrying in {wait}s",
                                )
                                time.sleep(wait)
                                continue
                            else:
                                logger.error(
                                    f"Gemini generate_content failed after {max_attempts} attempts",
                                )
                                raise
                        raise
                # If we exit the loop without returning, raise the last error
                if last_error:
                    raise last_error
                raise RuntimeError(
                    'generate_content failed with no error captured',
                )

            if structured_schema:
                # Use JSON mode instead of response_schema to avoid complexity issues
                logger.info('Using JSON mode for structured output')
                json_prompt = f"""{input.prompt}

IMPORTANT: Return ONLY valid JSON matching the exact structure below. Do not include markdown code blocks, backticks, or any other formatting. Return pure JSON only:

{json.dumps(structured_schema.model_json_schema(), indent=2)}

Remember: Pure JSON only, no ```json wrapper, no explanations."""

                contents[0].parts[0] = types.Part(text=json_prompt)

                # Generate content (blocking operation - now in thread)
                response = _attempt_generate(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type='application/json',
                    ),
                )

                try:
                    # Clean the response text to handle markdown code blocks
                    response_text = response.text.strip()

                    # Remove markdown code block wrapper if present
                    if response_text.startswith('```json'):
                        response_text = response_text[7:]  # Remove '```json'
                    elif response_text.startswith('```'):
                        response_text = response_text[3:]   # Remove '```'

                    if response_text.endswith('```'):
                        # Remove trailing '```'
                        response_text = response_text[:-3]

                    response_text = response_text.strip()

                    # Parse JSON
                    structured_data = structured_schema(
                        **json.loads(response_text),
                    )
                    description = 'Structured data extracted via JSON mode'
                    logger.info('Successfully parsed structured output')

                except Exception as parse_error:
                    logger.error(f"JSON parsing failed: {parse_error}")
                    logger.error(f"Raw response: {response.text}")
                    structured_data = None
                    description = response.text
            else:
                # Generate content (blocking operation - now in thread)
                response = _attempt_generate(
                    model=model_name,
                    contents=contents,
                )
                description = response.text
                structured_data = None

            # Cleanup uploaded file
            if uploaded_file:
                client.files.delete(name=uploaded_file.name)

            return LLMVisionOutput(
                description=description,
                structured_data=structured_data,
            )

        except Exception:
            # Cleanup on error
            if uploaded_file:
                try:
                    self.client.files.delete(name=uploaded_file.name)
                except Exception:
                    pass
            raise
