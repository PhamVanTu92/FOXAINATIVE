"""Sentence-level streaming TTS helper.

Used by the chat stream to synthesize audio one sentence at a time and emit it
inline (``audio_chunk`` SSE events) so the client can start speaking before the
whole answer is written. Self-contained — it does NOT touch the one-shot
``/v1/tts/synthesize`` endpoint, and every call is best-effort (never raises) so
a TTS hiccup can never break text streaming.
"""
from __future__ import annotations

import re
import struct
from typing import List
from typing import Optional
from typing import Tuple

from google import genai
from google.genai import types
from joint.logging import get_logger

logger = get_logger(__name__)

# Gemini TTS output format (24kHz, 16-bit, mono PCM).
TTS_SAMPLE_RATE = 24000
TTS_CHANNELS = 1
TTS_BIT_DEPTH = 16

# Module-level singleton client (genai.Client wraps an httpx client; reuse it).
_tts_client: Optional[genai.Client] = None


def reset_streaming_tts_client() -> None:
    """Drop the cached client (e.g. after a Gemini API key change)."""
    global _tts_client
    _tts_client = None


def _get_client(api_key: str) -> genai.Client:
    global _tts_client
    if _tts_client is None:
        _tts_client = genai.Client(api_key=api_key)
    return _tts_client


def _pcm_to_wav(pcm: bytes) -> bytes:
    """Prepend a 44-byte WAV header so the browser can ``decodeAudioData``."""
    byte_rate = TTS_SAMPLE_RATE * TTS_CHANNELS * (TTS_BIT_DEPTH // 8)
    block_align = TTS_CHANNELS * (TTS_BIT_DEPTH // 8)
    data_size = len(pcm)
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_size, b'WAVE', b'fmt ', 16, 1,
        TTS_CHANNELS, TTS_SAMPLE_RATE, byte_rate, block_align,
        TTS_BIT_DEPTH, b'data', data_size,
    )
    return header + pcm


# Sentence-ending punctuation (Latin/Vietnamese share these). Newlines also
# break so bullet/numbered list items each become their own utterance.
_BOUNDARY = re.compile(r'[.!?…;\n]')


def split_complete_sentences(buffer: str) -> Tuple[List[str], str]:
    """Pull complete sentences out of a growing text buffer.

    Args:
        buffer: Accumulated (possibly partial) streamed text.

    Returns:
        ``(sentences, remainder)`` — ``remainder`` is the trailing partial
        sentence still being written; keep it and feed it back next time.
    """
    sentences: List[str] = []
    last = 0
    for match in _BOUNDARY.finditer(buffer):
        start, end = match.start(), match.end()
        # Don't break a decimal / thousands separator like "4.250".
        if match.group() == '.' and 0 < start and end < len(buffer):
            if buffer[start - 1].isdigit() and buffer[end].isdigit():
                continue
        segment = buffer[last:end].strip()
        if len(segment) >= 2:
            sentences.append(segment)
            last = end
    return sentences, buffer[last:]


async def synthesize_sentence_wav(
    text: str, *, api_key: str, model: str, voice: str,
) -> Optional[bytes]:
    """Synthesize one sentence into a self-contained WAV blob.

    Args:
        text: A single sentence to read aloud.
        api_key: Gemini API key.
        model: Gemini TTS model id.
        voice: Prebuilt voice name.

    Returns:
        WAV bytes, or ``None`` on empty/failed synthesis (never raises).
    """
    clean = text.strip()
    if not clean:
        return None
    try:
        client = _get_client(api_key)
        # The preview TTS model needs an explicit speak-instruction or it
        # rejects with 400 "Model tried to generate text".
        prompt = f'Read aloud in a natural, friendly tone:\n{clean}'
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['AUDIO'],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        ),
                    ),
                ),
            ),
        )
        if (
            response.candidates
            and response.candidates[0].content
            and response.candidates[0].content.parts
        ):
            part = response.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                return _pcm_to_wav(part.inline_data.data)
        logger.warning('Streaming TTS returned empty audio')
        return None
    except Exception as e:
        logger.warning(f'Streaming TTS failed for a sentence: {e}')
        return None
