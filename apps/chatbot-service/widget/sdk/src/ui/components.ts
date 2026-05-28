/**
 * FoxAI Widget SDK - UI Components
 * @module ui/components
 */

import type { UIElements } from '../types';
import { state } from '../core/state';
import { DOM_IDS } from '../core/constants';

/**
 * Inject widget styles into document head
 * Note: CSS is injected automatically by Rollup postcss plugin via index.ts
 * This function is kept for manual style injection if needed
 */
export function injectStyles(): void {
    if (document.getElementById(DOM_IDS.STYLES)) return;
    // CSS is automatically injected by the build process
}

/**
 * Create chat button element
 * @returns Chat button element
 */
export function createChatButton(): HTMLDivElement {
    const button = document.createElement('div');
    button.className = 'foxai-public-chat-button';
    button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
    document.body.appendChild(button);
    return button;
}

/**
 * Create chat window element
 * @returns Chat window element and references to child elements
 */
export function createChatWindow(): UIElements {
    const window = document.createElement('div');
    window.className = 'foxai-public-chat-window foxai-public-widget-container';
    
    const avatarHtml = state.config.uiConfig.botAvatar
        ? `<img src="${state.config.uiConfig.botAvatar}" alt="Bot">`
        : state.config.uiConfig.botName.charAt(0).toUpperCase();
    
    // foxai-native: hide mic / speaker controls unless the operator enabled
    // voice mode on this chatbot (form = 'voice' or 'both').
    const voiceEnabled = state.chatbotForm === 'voice' || state.chatbotForm === 'both';
    const hidden = (cond: boolean) => (cond ? '' : 'style="display:none"');

    window.innerHTML = `
        <div class="foxai-public-chat-header">
            <div class="foxai-public-chat-header-info">
                <div class="foxai-public-bot-avatar">${avatarHtml}</div>
                <div class="foxai-public-bot-name">${state.config.uiConfig.botName}</div>
            </div>
            <div class="foxai-public-header-actions">
                <button class="foxai-public-speaker-button" ${hidden(voiceEnabled)} title="Bật/tắt đọc tin nhắn">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                </button>
                <button class="foxai-public-close-button">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="foxai-public-messages-container"></div>
        <div class="foxai-public-input-container">
            <button class="foxai-public-mic-button" ${hidden(voiceEnabled)}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
            </button>
            <div class="foxai-public-input-wrapper">
                <textarea class="foxai-public-input" placeholder="Nhập tin nhắn..." rows="1"></textarea>
            </div>
            <button class="foxai-public-send-button">
                <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </button>
        </div>
    `;

    document.body.appendChild(window);

    return {
        button: null, // Will be set separately
        window: window,
        messagesContainer: window.querySelector('.foxai-public-messages-container'),
        input: window.querySelector('.foxai-public-input'),
        sendButton: window.querySelector('.foxai-public-send-button'),
        closeButton: window.querySelector('.foxai-public-close-button'),
        micButton: window.querySelector('.foxai-public-mic-button'),
        speakerButton: window.querySelector('.foxai-public-speaker-button'),
    };
}

/**
 * Create complete widget UI
 * @returns All UI element references
 */
export function createWidget(): UIElements {
    injectStyles();
    
    const button = createChatButton();
    const elements = createChatWindow();
    elements.button = button;
    
    return elements;
}

/**
 * Destroy widget UI elements
 * @param elements - UI elements to destroy
 */
export function destroyWidget(elements: UIElements): void {
    elements.button?.remove();
    elements.window?.remove();
    
    const styles = document.getElementById(DOM_IDS.STYLES);
    if (styles) {
        styles.remove();
    }
}
