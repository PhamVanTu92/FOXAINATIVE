/**
 * FoxAI Widget SDK - Default Configuration
 * @module core/config
 */

import type { WidgetConfig, UIConfig, InitConfig } from '../types';

/** Default UI configuration (foxai-native neutral defaults — operator config wins) */
export const DEFAULT_UI_CONFIG: UIConfig = {
    position: 'right',
    hideGreeting: false,
    theme: 'light',
    primaryColor: import.meta.env.VITE_DEFAULT_PRIMARY_COLOR || '#0066cc',
    botName: import.meta.env.VITE_DEFAULT_BOT_NAME || 'Trợ lý FoxAI Native',
    botAvatar: import.meta.env.VITE_DEFAULT_BOT_AVATAR || '',
    greetingMessage: import.meta.env.VITE_DEFAULT_GREETING || 'Xin chào! Tôi có thể giúp gì cho bạn?',
};

/** Default widget configuration */
export const DEFAULT_CONFIG: WidgetConfig = {
    apiUrl: import.meta.env.VITE_API_BASE_URL || 'https://chatbotnative.foxai.com.vn',
    providerLlm: import.meta.env.VITE_DEFAULT_PROVIDER_LLM || 'openai',
    providerStorage: import.meta.env.VITE_DEFAULT_PROVIDER_STORAGE || 'qdrant',
    providerEmbedding: import.meta.env.VITE_DEFAULT_PROVIDER_EMBEDDING || 'openai',
    collectionName: import.meta.env.VITE_DEFAULT_COLLECTION_NAME || 'foxai_native_default',
    uiConfig: DEFAULT_UI_CONFIG,
};

/**
 * Merge user config with defaults
 * @param userConfig - User provided configuration
 * @returns Merged configuration
 */
export function mergeConfig(userConfig: InitConfig): WidgetConfig {
    return {
        apiUrl: userConfig.apiUrl ?? DEFAULT_CONFIG.apiUrl,
        providerLlm: userConfig.providerLlm ?? DEFAULT_CONFIG.providerLlm,
        providerStorage: userConfig.providerStorage ?? DEFAULT_CONFIG.providerStorage,
        providerEmbedding: userConfig.providerEmbedding ?? DEFAULT_CONFIG.providerEmbedding,
        collectionName: userConfig.collectionName ?? DEFAULT_CONFIG.collectionName,
        uiConfig: {
            ...DEFAULT_UI_CONFIG,
            ...userConfig.uiConfig,
        },
    };
}
