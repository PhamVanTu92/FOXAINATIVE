/**
 * FoxAI Widget SDK - Constants
 * @module core/constants
 */

/** SDK version */
export const SDK_VERSION = '1.0.0';

/** SDK name for logging */
export const SDK_NAME = 'FoxAI';

/** LocalStorage key prefix */
export const STORAGE_PREFIX = 'foxai_';

/** API version from environment */
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';

/** API endpoints */
export const API_ENDPOINTS = {
    /** Streaming chat endpoint */
    CHAT_STREAM: `/${API_VERSION}/agents/public/chat/public/stream`,
    /** Non-streaming chat endpoint */
    CHAT: `/${API_VERSION}/agents/public/chat/public`,
    /** Public chatbot config (foxai-native): GET /v1/public/chatbots/{public_id} */
    PUBLIC_CHATBOT: `/${API_VERSION}/public/chatbots`,
    /** TTS synthesis (foxai-native voice mode): POST /v1/tts/synthesize → audio/wav */
    TTS_SYNTHESIZE: `/${API_VERSION}/tts/synthesize`,
} as const;

/** CSS class prefix */
export const CSS_PREFIX = 'foxai-public';

/** DOM element IDs */
export const DOM_IDS = {
    STYLES: 'foxai-public-widget-styles',
    TYPING_INDICATOR: 'foxai-public-typing-indicator',
} as const;

/** Supported audio MIME types (in priority order) */
export const SUPPORTED_AUDIO_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
] as const;

/** Default speech recognition language */
export const DEFAULT_SPEECH_LANG = 'vi-VN';

/** Retry configuration */
export const RETRY_CONFIG = {
    /** Number of retry attempts */
    MAX_RETRIES: 1,
    /** Delay between retries in ms */
    RETRY_DELAY: 2000,
} as const;
