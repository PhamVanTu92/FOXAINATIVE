/**
 * FoxAI Widget SDK - SSE Streaming Handler
 * @module api/streaming
 */

import type { StreamEvent, ChatMessage } from '../types';
import { state } from '../core/state';
import { saveToStorage } from '../utils/storage';
import { createLogger } from '../utils/helpers';
import * as api from './client';
import { playTTS } from '../ui/ttsPlayer';

const logger = createLogger('Chat');

/** Callback for adding messages */
type AddMessageCallback = (message: ChatMessage) => void;

/** Callback for updating last bot message */
type UpdateMessageCallback = (content: string) => void;

/** Callback for hiding typing indicator */
type HideTypingCallback = () => void;

/**
 * Process SSE streaming response
 * @param message - User message to send
 * @param callbacks - UI callback functions
 */
export async function sendMessageStreaming(
    message: string,
    callbacks: {
        addMessage: AddMessageCallback;
        updateMessage: UpdateMessageCallback;
        hideTyping: HideTypingCallback;
    }
): Promise<void> {
    // foxai-native: when the operator enabled voice mode and the user toggled
    // the speaker, kick off TTS once the full bot reply has streamed in.
    const maybeSpeak = (text: string) => {
        if (!text.trim()) return;
        if (!state.isTTSEnabled) return;
        if (state.chatbotForm !== 'voice' && state.chatbotForm !== 'both') return;
        // Fire-and-forget: playTTS handles its own errors.
        void playTTS(text);
    };
    try {
        logger.log('Sending streaming message');
        
        const response = await api.sendMessageStreaming(message, state.conversationId);
        
        let botMessageContent = '';
        let isFirstChunk = true;
        
        // Read SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is null');
        }
        
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    if (data === '[DONE]') {
                        logger.log('Stream completed');
                        continue;
                    }
                    
                    try {
                        const event = JSON.parse(data) as StreamEvent;
                        
                        // Always trust conversation_started event from backend as source of truth
                        // This handles cases where backend creates a new conversation (e.g., old one was deleted)
                        if (event.type === 'conversation_started' && event.conversation_id) {
                            state.conversationId = event.conversation_id;
                            saveToStorage('conversation_id', state.conversationId);
                            logger.log('Saved conversation_id:', state.conversationId);
                        }
                        
                        // Skip non-content events (e.g., conversation_started, keep_alive)
                        if (event.type === 'conversation_started' || event.type === 'keep_alive') {
                            continue;
                        }
                        
                        // Handle message chunks
                        if (event.type === 'message_chunk' && event.content) {
                            if (isFirstChunk) {
                                // Hide typing indicator on first content chunk
                                callbacks.hideTyping();
                                // Add initial bot message
                                callbacks.addMessage({
                                    type: 'bot',
                                    content: event.content,
                                    timestamp: new Date(),
                                });
                                botMessageContent = event.content;
                                isFirstChunk = false;
                            } else {
                                // Update existing message
                                botMessageContent += event.content;
                                callbacks.updateMessage(botMessageContent);
                            }
                        }
                    } catch (e) {
                        logger.warn('Failed to parse event:', e);
                    }
                }
            }
        }
        
        // If no chunks received, hide typing and show error
        if (isFirstChunk) {
            callbacks.hideTyping();
            callbacks.addMessage({
                type: 'bot',
                content: 'Không nhận được phản hồi từ server.',
                timestamp: new Date(),
            });
        } else {
            maybeSpeak(botMessageContent);
        }

    } catch (error) {
        logger.error('Streaming error:', error);
        
        // Better error handling with user-friendly messages
        let userMessage = 'An error occurred while sending message.';
        
        if (error instanceof Error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                userMessage = 'Unable to connect to server. Please check your network connection.';
            } else if (error.message.includes('HTTP error')) {
                if (error.message.includes('500')) {
                    userMessage = 'Internal server error. Please try again later.';
                } else if (error.message.includes('404')) {
                    userMessage = 'API endpoint not found. Please check configuration.';
                } else if (error.message.includes('429')) {
                    userMessage = 'Too many requests. Please wait a moment and try again.';
                }
            }
        }
        
        // Ensure typing indicator is removed before showing error
        callbacks.hideTyping();
        callbacks.addMessage({
            type: 'bot',
            content: `❌ ${userMessage}`,
            timestamp: new Date(),
        });
        
        throw error;
    }
}
