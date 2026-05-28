/**
 * FoxAI Widget SDK - TTS Audio Player
 * @module ui/ttsPlayer
 *
 * Plays back WAV audio returned by the /v1/tts/synthesize endpoint via
 * the Web Audio API. Lazily creates an AudioContext to satisfy browser
 * autoplay policies (created during a user gesture / first message send).
 */

import { state } from '../core/state';
import { synthesizeSpeech } from '../api/tts';
import { createLogger } from '../utils/helpers';

const logger = createLogger('TTS-Player');

let abortController: AbortController | null = null;
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext || audioContext.state === 'closed') {
        const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
        if (!Ctor) {
            throw new Error('Web Audio API not supported in this browser');
        }
        audioContext = new Ctor();
    }
    return audioContext;
}

/**
 * Fetch TTS audio for ``text`` and play it. Cancels any in-flight request
 * or current playback first so concurrent ``playTTS`` calls don't overlap.
 */
export async function playTTS(text: string): Promise<void> {
    if (!text || !text.trim()) return;

    stopTTS();
    abortController = new AbortController();

    try {
        state.isTTSPlaying = true;
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const wavData = await synthesizeSpeech(text, abortController.signal);
        if (abortController.signal.aborted) return;

        const audioBuffer = await ctx.decodeAudioData(wavData.slice(0));

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
            currentSource = null;
            state.isTTSPlaying = false;
        };
        currentSource = source;
        source.start(0);
        logger.log('Playback started', { durationSec: audioBuffer.duration.toFixed(2) });
    } catch (error: unknown) {
        state.isTTSPlaying = false;
        if (error instanceof DOMException && error.name === 'AbortError') {
            return;
        }
        logger.error('TTS playback failed:', error);
    }
}

export function stopTTS(): void {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    if (currentSource) {
        try {
            currentSource.stop();
        } catch {
            // already stopped
        }
        currentSource = null;
    }
    state.isTTSPlaying = false;
}

export function isTTSPlaying(): boolean {
    return state.isTTSPlaying;
}
