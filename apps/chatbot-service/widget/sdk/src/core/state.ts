/**
 * FoxAI Widget SDK - Global State Management
 * @module core/state
 */

import type { WidgetState, ChatMessage, WidgetConfig } from '../types';
import { DEFAULT_CONFIG } from './config';

/**
 * Global widget state
 * Single source of truth for widget status
 */
export const state: WidgetState = {
    initialized: false,
    isOpen: false,
    conversationId: null,
    config: { ...DEFAULT_CONFIG },
    messages: [],
    clientId: null,
    chatbotId: null,
    chatbotForm: 'chat',
    isTTSEnabled: false,
    isTTSPlaying: false,
    isRecording: false,
    recognition: null,
    mediaRecorder: null,
    audioChunks: [],
};

/**
 * Update widget configuration
 * @param config - New configuration to merge
 */
export function updateConfig(config: Partial<WidgetConfig>): void {
    state.config = {
        ...state.config,
        ...config,
        uiConfig: {
            ...state.config.uiConfig,
            ...(config.uiConfig ?? {}),
        },
    };
}

/**
 * Add message to state
 * @param message - Message to add
 */
export function addMessage(message: ChatMessage): void {
    state.messages.push(message);
}

/**
 * Reset state to initial values
 */
export function resetState(): void {
    state.initialized = false;
    state.isOpen = false;
    state.conversationId = null;
    state.messages = [];
    state.clientId = null;
    state.chatbotId = null;
    state.chatbotForm = 'chat';
    state.isTTSEnabled = false;
    state.isTTSPlaying = false;
    state.isRecording = false;
    state.recognition = null;
    state.mediaRecorder = null;
    state.audioChunks = [];
}
