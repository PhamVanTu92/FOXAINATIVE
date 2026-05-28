/**
 * FoxAI Widget SDK - TypeScript Type Definitions
 * @module types
 */

// Import environment type definitions
/// <reference types="./env" />

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Widget UI configuration options
 */
export interface UIConfig {
    /** Widget position on screen */
    position: 'left' | 'right';
    /** Hide greeting message on first open */
    hideGreeting: boolean;
    /** Widget color theme */
    theme: 'light' | 'dark';
    /** Primary color (hex code) */
    primaryColor: string;
    /** Bot display name */
    botName: string;
    /** Bot avatar URL or empty string */
    botAvatar: string;
    /** Welcome message shown on first open */
    greetingMessage: string;
}

/**
 * Main widget configuration
 */
export interface WidgetConfig {
    /** API base URL */
    apiUrl: string;
    /** LLM provider (e.g., 'openai') */
    providerLlm: string;
    /** Storage provider (e.g., 'qdrant') */
    providerStorage: string;
    /** Embedding provider (e.g., 'openai') */
    providerEmbedding: string;
    /** Vector collection name */
    collectionName: string;
    /** UI configuration */
    uiConfig: UIConfig;
}

/**
 * Partial configuration for initialization
 */
export interface InitConfig {
    apiUrl?: string;
    providerLlm?: string;
    providerStorage?: string;
    providerEmbedding?: string;
    collectionName?: string;
    /** foxai-native: opt-in to chatbot-bound mode. When set, the widget
     * fetches the chatbot's stored config and chat requests include
     * `public_id` so the backend applies the saved providers/collections/prompt. */
    chatbotId?: string;
    uiConfig?: Partial<UIConfig>;
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Chat message type
 */
export interface ChatMessage {
    /** Message sender type */
    type: 'user' | 'bot';
    /** Message content (may contain markdown) */
    content: string;
    /** Message timestamp */
    timestamp: Date;
}

/** Speech Recognition interface for cross-browser support */
interface SpeechRecognitionType {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
}

/** Speech Recognition Event */
interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    readonly length: number;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

/** Speech Recognition Error Event */
interface SpeechRecognitionErrorEvent {
    error: string;
    message?: string;
}

/**
 * Widget state management
 */
export interface WidgetState {
    /** Whether widget is initialized */
    initialized: boolean;
    /** Whether chat window is open */
    isOpen: boolean;
    /** Current conversation ID */
    conversationId: string | null;
    /** Widget configuration */
    config: WidgetConfig;
    /** Chat messages history */
    messages: ChatMessage[];
    /** Client fingerprint ID */
    clientId: string | null;
    /** foxai-native: bound chatbot public_id (rotatable embed token). */
    chatbotId: string | null;
    /** foxai-native: chatbot.form — 'chat' | 'voice' | 'both'. Controls whether
     *  mic and speaker controls appear and whether TTS auto-plays. */
    chatbotForm: 'chat' | 'voice' | 'both';
    /** foxai-native: user-controlled toggle to auto-speak bot replies. */
    isTTSEnabled: boolean;
    /** foxai-native: whether a TTS clip is currently playing. */
    isTTSPlaying: boolean;
    /** Whether audio recording is active */
    isRecording: boolean;
    /** Speech Recognition instance */
    recognition: SpeechRecognitionType | null;
    /** MediaRecorder instance */
    mediaRecorder: MediaRecorder | null;
    /** Audio recording chunks */
    audioChunks: Blob[];
}

// ============================================================================
// API Types
// ============================================================================

/**
 * API request payload
 */
export interface APIPayload {
    message: string;
    client_id: string | null;
    conversation_id: string | null;
    provider_llm: string;
    provider_storage: string;
    provider_embedding: string;
    collection_name: string;
    /** foxai-native: chatbot public_id. When present, the backend overrides
     * providers/collections/prompt with the chatbot's saved configuration. */
    public_id?: string;
}

/**
 * Public chatbot config returned by GET /v1/public/chatbots/{public_id}.
 */
export interface PublicChatbotConfig {
    public_id: string;
    name: string;
    form: string;
    welcome_message: string | null;
    widget_theme: Record<string, unknown> | null;
    is_active: boolean;
}

/**
 * SSE stream event
 */
export interface StreamEvent {
    type?: 'message_chunk' | 'message_complete' | 'conversation_started' | 'keep_alive' | 'error' | 'done';
    content?: string;
    conversation_id?: string;
    error?: string;
}

// ============================================================================
// UI Types
// ============================================================================

/**
 * UI DOM element references
 */
export interface UIElements {
    button: HTMLDivElement | null;
    window: HTMLDivElement | null;
    messagesContainer: HTMLDivElement | null;
    input: HTMLTextAreaElement | null;
    sendButton: HTMLButtonElement | null;
    closeButton: HTMLButtonElement | null;
    micButton: HTMLButtonElement | null;
    /** foxai-native: speaker toggle (TTS auto-play). Hidden when chatbot.form='chat'. */
    speakerButton: HTMLButtonElement | null;
}

/**
 * Script data attributes configuration
 */
export interface ScriptConfig {
    apiUrl: string | null;
    botName: string | null;
    primaryColor: string | null;
    position: string | null;
    greeting: string | null;
    providerLlm: string | null;
    providerStorage: string | null;
    providerEmbedding: string | null;
    collectionName: string | null;
    /** foxai-native: chatbot public_id supplied via `data-chatbot-id`. */
    chatbotId: string | null;
}

// ============================================================================
// Public API Types
// ============================================================================

/**
 * FoxAI Widget Public API
 */
export interface FoxAIWidgetAPI {
    /** SDK version */
    readonly version: string;
    
    /**
     * Initialize the widget
     * @param config - Optional configuration
     */
    init(config?: InitConfig): Promise<void>;
    
    /**
     * Open the chat window
     */
    open(): void;
    
    /**
     * Close the chat window
     */
    close(): void;
    
    /**
     * Remove widget from page
     */
    destroy(): void;
}

// ============================================================================
// Global Type Extensions
// ============================================================================

declare global {
    interface Window {
        FoxAI?: FoxAIWidgetAPI;
        foxaiAsyncInit?: () => void;
        SpeechRecognition?: new () => SpeechRecognitionType;
        webkitSpeechRecognition?: new () => SpeechRecognitionType;
    }
}
