"""Text-to-Speech endpoint (foxai-native).

Public endpoint — the widget calls this to convert the bot's reply into
spoken audio when the operator has set the chatbot ``form`` to ``voice``
or ``both``. Wraps Gemini's raw PCM (24kHz, 16-bit, mono) into a minimal
WAV container so the browser can decode it via
``AudioContext.decodeAudioData`` without custom PCM handling.

Provider: Gemini one-shot TTS (``gemini-2.5-flash-preview-tts``).
"""
from __future__ import annotations

import struct
import uuid
from typing import List
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import Response
from google import genai
from google.genai import types
from joint.logging import get_logger
from joint.postgres.database import ChatbotController
from joint.utils import get_settings
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.helpers.dependencies.database import get_db_session

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()

# Singleton client. genai.Client wraps an HTTPX client; reuse across requests.
_tts_client: genai.Client | None = None

MAX_TTS_TEXT_LENGTH = 5000

_controller = ChatbotController()

# Available TTS voices (Gemini prebuilt, multilingual — read Vietnamese fine).
# ``id`` is what the client sends back as ``voice_id`` when synthesizing.
VOICES = [
    {'id': 'Zephyr', 'name': 'Zephyr', 'gender': 'female', 'language': 'multilingual'},
    {'id': 'Puck',   'name': 'Puck',   'gender': 'male',   'language': 'multilingual'},
    {'id': 'Charon', 'name': 'Charon', 'gender': 'male',   'language': 'multilingual'},
    {'id': 'Kore',   'name': 'Kore',   'gender': 'female', 'language': 'multilingual'},
    {'id': 'Fenrir', 'name': 'Fenrir', 'gender': 'male',   'language': 'multilingual'},
    {'id': 'Leda',   'name': 'Leda',   'gender': 'female', 'language': 'multilingual'},
    {'id': 'Orus',   'name': 'Orus',   'gender': 'male',   'language': 'multilingual'},
    {'id': 'Aoede',  'name': 'Aoede',  'gender': 'female', 'language': 'multilingual'},
]

# Voice ids the SDK is allowed to request. Anything outside falls back to the
# server default.
ALLOWED_VOICES = {v['id'] for v in VOICES}

# Gemini TTS output format.
TTS_SAMPLE_RATE = 24000
TTS_CHANNELS = 1
TTS_BIT_DEPTH = 16


def _pcm_to_wav(pcm: bytes) -> bytes:
    """Prepend a minimal 44-byte WAV header to raw PCM so the browser can decode.

    The Web Audio API's ``decodeAudioData`` accepts WAV/MP3/etc. — not raw PCM.
    Wrapping at the server avoids shipping PCM-decoding code in the SDK.
    """
    byte_rate = TTS_SAMPLE_RATE * TTS_CHANNELS * (TTS_BIT_DEPTH // 8)
    block_align = TTS_CHANNELS * (TTS_BIT_DEPTH // 8)
    data_size = len(pcm)
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,            # ChunkSize
        b'WAVE',
        b'fmt ',
        16,                        # Subchunk1Size (PCM)
        1,                         # AudioFormat (1 = PCM)
        TTS_CHANNELS,
        TTS_SAMPLE_RATE,
        byte_rate,
        block_align,
        TTS_BIT_DEPTH,
        b'data',
        data_size,
    )
    return header + pcm


def _get_tts_client() -> genai.Client:
    global _tts_client
    if _tts_client is None:
        logger.info('Initializing Gemini TTS client')
        _tts_client = genai.Client(api_key=settings.gemini.api_key)
    return _tts_client


def reset_tts_client() -> None:
    """Drop the cached client (used by app shutdown)."""
    global _tts_client
    if _tts_client is not None:
        logger.info('Resetting Gemini TTS client')
        _tts_client = None


class TtsVoiceOut(BaseModel):
    """A selectable TTS voice (for the client voice picker)."""
    id: str
    name: str
    gender: str
    language: str


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TTS_TEXT_LENGTH)
    voice_id: Optional[str] = Field(
        None,
        description='Voice id from GET /v1/tts/voices (e.g. "Kore"). '
                    'The text is read aloud in this voice.',
    )
    voice_name: Optional[str] = Field(
        None,
        description='Deprecated alias of voice_id.',
    )
    public_id: Optional[uuid.UUID] = Field(
        None,
        description='Optional chatbot public_id. When set, gates TTS on '
                    'chatbot.form == voice/both and uses the chatbot-configured voice.',
    )


@router.get(
    '/voices',
    response_model=List[TtsVoiceOut],
    summary='List available TTS voices',
)
async def list_voices() -> List[TtsVoiceOut]:
    """Return the voices the user can pick from in the voice selector."""
    return [TtsVoiceOut(**voice) for voice in VOICES]


@router.post(
    '/synthesize',
    summary='Synthesize speech from text',
    response_class=Response,
)
async def synthesize_speech(
    request_body: TTSRequest = Body(...),
    db: Session = Depends(get_db_session),
) -> Response:
    """Convert text → PCM audio bytes via Gemini TTS.

    Returns ``audio/pcm`` (24kHz, 16-bit, mono). Headers carry the audio
    format so the client can wrap into WAV before ``decodeAudioData``.
    """
    text = request_body.text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Text cannot be empty after trimming.',
        )

    # If a chatbot id is supplied, verify it's voice-enabled. Without this gate
    # any caller could spend Gemini TTS quota for arbitrary chatbots.
    voice_override: Optional[str] = None
    if request_body.public_id is not None:
        bot = _controller.get_by_public_id(db, request_body.public_id)
        if not bot or not bot.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Chatbot not found or inactive',
            )
        if bot.form not in ('voice', 'both'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Voice mode is not enabled for this chatbot',
            )
        # Operators can stash a preferred voice in widget_theme.voiceName.
        if isinstance(bot.widget_theme, dict):
            v = bot.widget_theme.get('voiceName')
            if isinstance(v, str) and v in ALLOWED_VOICES:
                voice_override = v

    # Resolution order: per-request override (whitelisted) > chatbot config > server default.
    # Caller's picked voice (voice_id preferred; voice_name kept for compat).
    requested_voice = request_body.voice_id or request_body.voice_name
    voice = (
        requested_voice
        if requested_voice in ALLOWED_VOICES
        else (voice_override or settings.gemini.tts_voice_name)
    )
    model = settings.gemini.tts_model

    logger.info(
        'TTS synthesis request',
        extra={'text_length': len(text), 'voice': voice, 'model': model},
    )

    try:
        client = _get_tts_client()
        # Gemini's TTS preview model needs an explicit speak-instruction or it
        # rejects with 400 "Model tried to generate text". A neutral "Read
        # aloud:" prefix nudges the model into pure-audio mode.
        prompt = f'Read aloud in a natural, friendly tone:\n{text}'
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

        audio_data: bytes | None = None
        if (
            response.candidates
            and response.candidates[0].content
            and response.candidates[0].content.parts
        ):
            part = response.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                audio_data = part.inline_data.data

        if not audio_data:
            logger.warning('TTS returned empty audio data')
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail='TTS service returned empty audio.',
            )

        wav_data = _pcm_to_wav(audio_data)
        logger.info(
            'TTS synthesis completed',
            extra={'pcm_bytes': len(audio_data), 'wav_bytes': len(wav_data)},
        )
        return Response(
            content=wav_data,
            media_type='audio/wav',
            headers={
                'X-Audio-Sample-Rate': str(TTS_SAMPLE_RATE),
                'X-Audio-Channels': str(TTS_CHANNELS),
                'X-Audio-Bit-Depth': str(TTS_BIT_DEPTH),
                'Content-Disposition': 'inline',
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'TTS synthesis failed: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to synthesize speech.',
        ) from e
