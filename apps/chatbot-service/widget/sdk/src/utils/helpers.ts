/**
 * FoxAI Widget SDK - Helper Utilities
 * @module utils/helpers
 */

import type { ScriptConfig } from '../types';
import { SUPPORTED_AUDIO_TYPES } from '../core/constants';

/**
 * Format date to time string (HH:MM)
 * @param date - Date object
 * @returns Formatted time string
 */
export function formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Get configuration from script data attributes
 * @returns Script configuration object
 */
export function getScriptConfig(): ScriptConfig {
    const scripts = document.getElementsByTagName('script');
    
    for (const script of scripts) {
        if (script.src && (script.src.includes('sdk.js') || script.src.includes('foxai-widget'))) {
            return {
                apiUrl: script.getAttribute('data-api-url'),
                botName: script.getAttribute('data-bot-name'),
                primaryColor: script.getAttribute('data-color'),
                position: script.getAttribute('data-position'),
                greeting: script.getAttribute('data-greeting'),
                providerLlm: null,
                providerStorage: null,
                providerEmbedding: null,
                collectionName: script.getAttribute('data-collection'),
                chatbotId: script.getAttribute('data-chatbot-id'),
            };
        }
    }

    return {
        apiUrl: null,
        botName: null,
        primaryColor: null,
        position: null,
        greeting: null,
        providerLlm: null,
        providerStorage: null,
        providerEmbedding: null,
        collectionName: null,
        chatbotId: null,
    };
}

/**
 * Check if browser is Safari
 * @returns True if Safari browser
 */
export function isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Get supported audio MIME type for MediaRecorder
 * @returns Supported MIME type or empty string
 */
export function getSupportedAudioType(): string {
    if (typeof MediaRecorder === 'undefined') {
        return '';
    }
    
    for (const type of SUPPORTED_AUDIO_TYPES) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log('[FoxAI Audio] Using audio type:', type);
            return type;
        }
    }
    
    console.warn('[FoxAI Audio] No specific audio type supported, using default');
    return '';
}

/**
 * Create logger with SDK prefix
 * @param module - Module name for logging
 * @returns Logger object with log, warn, error methods
 */
export function createLogger(module: string) {
    const prefix = `[FoxAI ${module}]`;
    return {
        log: (...args: unknown[]) => console.log(prefix, ...args),
        warn: (...args: unknown[]) => console.warn(prefix, ...args),
        error: (...args: unknown[]) => console.error(prefix, ...args),
    };
}

/**
 * Debounce function execution
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
