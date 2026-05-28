/**
 * FoxAI Widget SDK - API Client
 * @module api/client
 */

import type { APIPayload, PublicChatbotConfig } from '../types';
import { state } from '../core/state';
import { API_ENDPOINTS } from '../core/constants';
import { createLogger } from '../utils/helpers';

const logger = createLogger('API');

/** API base URL (set during init) */
let baseUrl = '';

/**
 * Initialize API client with base URL
 * @param apiUrl - Base API URL
 */
export function initAPI(apiUrl: string): void {
    baseUrl = apiUrl;
}

/**
 * Create API payload with common fields
 * @param message - User message
 * @param conversationId - Optional conversation ID
 * @returns API payload object
 */
export function createPayload(message: string, conversationId: string | null = null): APIPayload {
    const payload: APIPayload = {
        message,
        client_id: state.clientId,
        conversation_id: conversationId,
        provider_llm: state.config.providerLlm,
        provider_storage: state.config.providerStorage,
        provider_embedding: state.config.providerEmbedding,
        collection_name: state.config.collectionName,
    };
    if (state.chatbotId) {
        payload.public_id = state.chatbotId;
    }
    return payload;
}

/**
 * Handle API response errors
 * @param response - Fetch response object
 * @throws Error with HTTP status
 */
async function handleResponseError(response: Response): Promise<void> {
    if (!response.ok) {
        const errorText = await response.text();
        logger.error('Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
}

/**
 * Send message with streaming response
 * @param message - User message
 * @param conversationId - Optional conversation ID
 * @returns Fetch response for streaming
 */
export async function sendMessageStreaming(
    message: string,
    conversationId: string | null = null
): Promise<Response> {
    const url = `${baseUrl}${API_ENDPOINTS.CHAT_STREAM}`;
    const payload = createPayload(message, conversationId);
    
    logger.log('Streaming request:', { url, payload });
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    
    await handleResponseError(response);
    return response;
}

/**
 * Fetch the public-safe chatbot config (foxai-native).
 * Used during init() to apply the operator-saved name / welcome message / theme
 * before the widget renders.
 */
export async function fetchPublicChatbot(
    publicId: string,
): Promise<PublicChatbotConfig> {
    const url = `${baseUrl}${API_ENDPOINTS.PUBLIC_CHATBOT}/${publicId}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });
    await handleResponseError(response);
    return await response.json() as PublicChatbotConfig;
}

/**
 * Send message with non-streaming response
 * @param message - User message
 * @param conversationId - Optional conversation ID
 * @returns API response data
 */
export async function sendMessage(
    message: string,
    conversationId: string | null = null
): Promise<unknown> {
    const url = `${baseUrl}${API_ENDPOINTS.CHAT}`;
    const payload = createPayload(message, conversationId);
    
    logger.log('Request:', { url, payload });
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    
    await handleResponseError(response);
    const data = await response.json();
    logger.log('Response:', data);
    return data;
}


