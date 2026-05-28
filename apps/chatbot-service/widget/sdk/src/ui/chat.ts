/**
 * FoxAI Widget SDK - Chat Logic Module
 * @module ui/chat
 */

import type { ChatMessage, UIElements } from '../types';
import { state, addMessage as addToState } from '../core/state';
import { parseMarkdown, formatTime } from '../utils';
import { streamChat } from '../api';
import { createLogger } from '../utils/helpers';
import { initAudio, handleMicClick, stopRecording } from './audio';
import { stopTTS } from './ttsPlayer';

const logger = createLogger('Chat');

let elements: UIElements = {
    button: null,
    window: null,
    messagesContainer: null,
    input: null,
    sendButton: null,
    closeButton: null,
    micButton: null,
    speakerButton: null,
};

/**
 * Initialize chat module with UI elements
 * @param uiElements - UI element references
 */
export function initChat(uiElements: UIElements): void {
    elements = uiElements;

    // Initialize audio module
    initAudio({
        micButton: elements.micButton,
        input: elements.input,
        sendButton: elements.sendButton,
    });

    // foxai-native: reflect persisted toggle state on the speaker button.
    if (state.isTTSEnabled) {
        elements.speakerButton?.classList.add('active');
    }

    attachEventListeners();
}

/**
 * Attach event listeners to chat elements
 */
function attachEventListeners(): void {
    // Toggle chat window
    elements.button?.addEventListener('click', () => toggleChat());
    elements.closeButton?.addEventListener('click', () => toggleChat());
    
    // Send message
    elements.sendButton?.addEventListener('click', () => handleSendMessage());
    elements.input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    // Auto-resize textarea
    elements.input?.addEventListener('input', () => {
        if (elements.input) {
            elements.input.style.height = 'auto';
            elements.input.style.height = elements.input.scrollHeight + 'px';
        }
    });
    
    // Microphone button
    elements.micButton?.addEventListener('click', () => handleMicClick());

    // foxai-native: TTS auto-play toggle. Clicking toggles the flag and stops
    // any in-flight playback so the user gets immediate feedback.
    elements.speakerButton?.addEventListener('click', () => {
        state.isTTSEnabled = !state.isTTSEnabled;
        elements.speakerButton?.classList.toggle('active', state.isTTSEnabled);
        if (!state.isTTSEnabled) stopTTS();
        logger.log('TTS auto-play:', state.isTTSEnabled);
    });
}

/**
 * Toggle chat window open/close
 */
export function toggleChat(): void {
    state.isOpen = !state.isOpen;
    
    if (state.isOpen) {
        elements.window?.classList.add('open');
        
        // Show greeting message if first time
        if (state.messages.length === 0 && !state.config.uiConfig.hideGreeting) {
            addMessage({
                type: 'bot',
                content: state.config.uiConfig.greetingMessage,
                timestamp: new Date(),
            });
        }
        
        elements.input?.focus();
    } else {
        elements.window?.classList.remove('open');
    }
}

/**
 * Add message to chat UI
 * @param message - Message to add
 */
export function addMessage(message: ChatMessage): void {
    addToState(message);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `foxai-public-message ${message.type}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'foxai-public-message-bubble';
    
    if (message.type === 'bot') {
        bubbleDiv.innerHTML = parseMarkdown(message.content);
    } else {
        bubbleDiv.textContent = message.content;
    }
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'foxai-public-message-time';
    timeDiv.textContent = formatTime(message.timestamp);
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.appendChild(bubbleDiv);
    wrapperDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(wrapperDiv);
    elements.messagesContainer?.appendChild(messageDiv);
    
    scrollToBottom();
}

/**
 * Update content of last bot message
 * @param content - New content
 */
export function updateLastBotMessage(content: string): void {
    const messages = elements.messagesContainer?.querySelectorAll('.foxai-public-message.bot');
    if (messages && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const bubble = lastMessage.querySelector('.foxai-public-message-bubble');
        if (bubble) {
            bubble.innerHTML = parseMarkdown(content);
            scrollToBottom();
        }
    }
}

/**
 * Show typing indicator
 */
export function showTypingIndicator(): void {
    const indicator = document.createElement('div');
    indicator.className = 'foxai-public-message bot';
    indicator.id = 'foxai-public-typing-indicator';
    indicator.innerHTML = `
        <div class="foxai-public-typing-indicator">
            <div class="foxai-public-typing-dot"></div>
            <div class="foxai-public-typing-dot"></div>
            <div class="foxai-public-typing-dot"></div>
        </div>
    `;
    elements.messagesContainer?.appendChild(indicator);
    scrollToBottom();
}

/**
 * Hide typing indicator
 */
export function hideTypingIndicator(): void {
    const indicator = document.getElementById('foxai-public-typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Scroll chat container to bottom
 */
export function scrollToBottom(): void {
    if (elements.messagesContainer) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }
}

/**
 * Handle send message action
 */
export async function handleSendMessage(): Promise<void> {
    if (!elements.input) return;
    
    const message = elements.input.value.trim();
    if (!message) return;
    
    // Stop recording if active
    if (state.isRecording) {
        stopRecording();
    }
    
    // Clear input
    elements.input.value = '';
    elements.input.style.height = 'auto';
    
    // Disable input
    elements.input.disabled = true;
    if (elements.sendButton) {
        elements.sendButton.disabled = true;
    }
    
    // Add user message
    addMessage({
        type: 'user',
        content: message,
        timestamp: new Date(),
    });
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Send with streaming
        await streamChat(message, {
            addMessage,
            updateMessage: updateLastBotMessage,
            hideTyping: hideTypingIndicator,
        });
    } catch (error) {
        logger.error('Error sending message:', error);
        hideTypingIndicator();
        addMessage({
            type: 'bot',
            content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
            timestamp: new Date(),
        });
    } finally {
        // Re-enable input
        if (elements.input) {
            elements.input.disabled = false;
        }
        if (elements.sendButton) {
            elements.sendButton.disabled = false;
        }
        elements.input?.focus();
    }
}

/**
 * Open chat window programmatically
 */
export function openChat(): void {
    if (!state.isOpen) {
        toggleChat();
    }
}

/**
 * Close chat window programmatically
 */
export function closeChat(): void {
    if (state.isOpen) {
        toggleChat();
    }
}
