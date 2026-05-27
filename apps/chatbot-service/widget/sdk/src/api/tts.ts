/**
 * FoxAI Widget SDK - TTS API Client
 * @module api/tts
 *
 * Calls the backend TTS endpoint and returns the raw WAV ArrayBuffer.
 * Browser's AudioContext.decodeAudioData handles the WAV container.
 */

import { state } from '../core/state';
import { API_ENDPOINTS } from '../core/constants';
import { createLogger } from '../utils/helpers';

const logger = createLogger('TTS-API');

/** API base URL captured at SDK init (mirrors api/client.ts). */
let baseUrl = '';

export function initTTSAPI(apiUrl: string): void {
    baseUrl = apiUrl;
}

/**
 * POST /v1/tts/synthesize with the text to speak.
 * When ``state.chatbotId`` is set, the backend gates TTS on the chatbot's
 * ``form`` field and may pick a chatbot-specific voice.
 */
export async function synthesizeSpeech(
    text: string,
    signal?: AbortSignal,
): Promise<ArrayBuffer> {
    const url = `${baseUrl}${API_ENDPOINTS.TTS_SYNTHESIZE}`;
    const body: Record<string, unknown> = { text };
    if (state.chatbotId) body.public_id = state.chatbotId;

    logger.log('Synthesize request:', { textLength: text.length });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('TTS response error:', response.status, errorText);
        throw new Error(`TTS HTTP error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    logger.log('Synthesize completed:', { audioBytes: buffer.byteLength });
    return buffer;
}
