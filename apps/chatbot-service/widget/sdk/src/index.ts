/**
 * FoxAI Widget SDK
 * Embeddable chat widget for FoxAI chatbot
 * 
 * @packageDocumentation
 * @module FoxAI
 * @version 1.0.0
 */

import type { InitConfig, FoxAIWidgetAPI, UIElements } from './types';
import { state, updateConfig, resetState } from './core/state';
import { mergeConfig, DEFAULT_UI_CONFIG, SDK_VERSION, RETRY_CONFIG } from './core';
import { initAPI, fetchPublicChatbot } from './api';
import { initTTSAPI } from './api/tts';
import { generateFingerprint, getScriptConfig, getFromStorage, createLogger } from './utils';
import { createWidget, destroyWidget, initChat, openChat, closeChat } from './ui';

// Import styles (will be injected by Rollup postcss plugin)
import './styles/widget.css';

const logger = createLogger('Widget');

/** UI elements reference */
let uiElements: UIElements | null = null;

/**
 * Initialize the FoxAI widget
 * @param config - Optional configuration object
 */
async function init(config?: InitConfig): Promise<void> {
    if (state.initialized) {
        if (!config) {
            logger.warn('Already initialized');
            return;
        }

        const mergedConfig = mergeConfig({
            apiUrl: config.apiUrl,
            providerLlm: config.providerLlm,
            providerStorage: config.providerStorage,
            providerEmbedding: config.providerEmbedding,
            collectionName: config.collectionName,
            uiConfig: config.uiConfig,
        });

        updateConfig(mergedConfig);
        initAPI(state.config.apiUrl);
        logger.log('Config updated after initialization:', state.config);
        return;
    }
    
    try {
        logger.log('Initializing...');

        // Get script config from data attributes
        const scriptConfig = getScriptConfig();

        // Generate fingerprint as client_id
        logger.log('Generating client ID...');
        const fingerprint = await generateFingerprint();
        state.clientId = fingerprint;
        logger.log('Client ID:', state.clientId.substring(0, 16) + '...');

        // foxai-native: remember chatbotId so chat requests can include public_id.
        const chatbotId = config?.chatbotId ?? scriptConfig.chatbotId ?? null;
        if (chatbotId) {
            state.chatbotId = chatbotId;
            logger.log('Bound chatbot public_id:', chatbotId);
        }

        // Merge configs: defaults < script attributes < init config
        const mergedConfig = mergeConfig({
            apiUrl: config?.apiUrl ?? scriptConfig.apiUrl ?? undefined,
            providerLlm: config?.providerLlm ?? undefined,
            providerStorage: config?.providerStorage ?? undefined,
            providerEmbedding: config?.providerEmbedding ?? undefined,
            collectionName: config?.collectionName ?? scriptConfig.collectionName ?? undefined,
            uiConfig: {
                position: (config?.uiConfig?.position ?? scriptConfig.position ?? DEFAULT_UI_CONFIG.position) as 'left' | 'right',
                hideGreeting: config?.uiConfig?.hideGreeting ?? DEFAULT_UI_CONFIG.hideGreeting,
                theme: (config?.uiConfig?.theme ?? DEFAULT_UI_CONFIG.theme) as 'light' | 'dark',
                primaryColor: config?.uiConfig?.primaryColor ?? scriptConfig.primaryColor ?? DEFAULT_UI_CONFIG.primaryColor,
                botName: config?.uiConfig?.botName ?? scriptConfig.botName ?? DEFAULT_UI_CONFIG.botName,
                botAvatar: config?.uiConfig?.botAvatar ?? DEFAULT_UI_CONFIG.botAvatar,
                greetingMessage: config?.uiConfig?.greetingMessage ?? scriptConfig.greeting ?? DEFAULT_UI_CONFIG.greetingMessage,
            },
        });

        updateConfig(mergedConfig);
        logger.log('Config:', state.config);

        // Initialize API (needs apiUrl before we can call any endpoint).
        initAPI(state.config.apiUrl);
        initTTSAPI(state.config.apiUrl);

        // foxai-native: when bound to a chatbot, pull the operator's saved
        // name / welcome message / theme and apply them before the widget
        // renders. Failure here is non-fatal — defaults still work.
        if (state.chatbotId) {
            try {
                const remote = await fetchPublicChatbot(state.chatbotId);
                if (!remote.is_active) {
                    logger.warn('Chatbot is inactive — widget will still render but backend will reject chat.');
                }
                // Voice mode comes from chatbot.form set in the operator's form.
                if (remote.form === 'chat' || remote.form === 'voice' || remote.form === 'both') {
                    state.chatbotForm = remote.form;
                }
                // Default TTS auto-play ON when voice mode is enabled; user can
                // still toggle via the speaker button.
                state.isTTSEnabled = state.chatbotForm === 'voice' || state.chatbotForm === 'both';
                updateConfig({
                    uiConfig: {
                        ...state.config.uiConfig,
                        botName: remote.name || state.config.uiConfig.botName,
                        greetingMessage:
                            remote.welcome_message || state.config.uiConfig.greetingMessage,
                        // widget_theme is opaque JSON for the operator; honor primaryColor when set.
                        primaryColor:
                            (typeof remote.widget_theme?.primaryColor === 'string'
                                ? (remote.widget_theme.primaryColor as string)
                                : state.config.uiConfig.primaryColor),
                    },
                });
                logger.log('Applied chatbot config:', remote.name, 'form=', state.chatbotForm);
            } catch (cfgErr) {
                logger.warn('Failed to fetch chatbot config — using defaults:', cfgErr);
            }
        }

        // Load saved conversation (after applying chatbot config so storage key
        // ordering doesn't matter).
        const savedConvId = getFromStorage<string>('conversation_id');
        if (savedConvId) {
            state.conversationId = savedConvId;
            logger.log('Loaded conversation:', savedConvId);
        }

        // Create UI
        uiElements = createWidget();
        
        // Initialize chat module
        initChat(uiElements);
        
        state.initialized = true;
        logger.log('✓ Initialized successfully');
        
    } catch (error) {
        logger.error('✗ Initialization failed:', error);
        throw error;
    }
}

/**
 * Open the chat widget
 */
function open(): void {
    openChat();
}

/**
 * Close the chat widget
 */
function close(): void {
    closeChat();
}

/**
 * Destroy the widget and cleanup
 */
function destroy(): void {
    if (uiElements) {
        destroyWidget(uiElements);
        uiElements = null;
    }
    resetState();
}

/**
 * FoxAI Widget Public API
 */
const FoxAI: FoxAIWidgetAPI = {
    version: SDK_VERSION,
    init,
    open,
    close,
    destroy,
};

// Export for ES modules
export { init, open, close, destroy };
export default FoxAI;

// Expose to window for UMD
if (typeof window !== 'undefined') {
    window.FoxAI = FoxAI;
    
    // Auto-initialization
    const autoInit = async (): Promise<void> => {
        // Check for manual init function
        if (typeof window.foxaiAsyncInit === 'function') {
            try {
                window.foxaiAsyncInit();
            } catch (error) {
                logger.error('Manual init error:', error);
            }
            return;
        }
        
        // Auto-init with retry
        try {
            logger.log('Auto-initializing...');
            await init({});
            logger.log('Auto-init completed');
        } catch (error) {
            logger.error('Auto-init failed:', error);
            
            // Retry once
            setTimeout(async () => {
                try {
                    logger.log('Retrying initialization...');
                    await init({});
                    logger.log('Retry completed');
                } catch (retryError) {
                    logger.error('Retry failed:', retryError);
                    logger.warn('Initialization failed completely. Check console for details.');
                }
            }, RETRY_CONFIG.RETRY_DELAY);
        }
    };
    
    // Run auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
}
