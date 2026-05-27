/**
 * FoxAI Widget SDK - UI Module Exports
 * @module ui
 */

export { createWidget, destroyWidget, injectStyles } from './components';
export { 
    initChat, 
    toggleChat, 
    openChat, 
    closeChat, 
    addMessage, 
    showTypingIndicator, 
    hideTypingIndicator 
} from './chat';
export { 
    initAudio, 
    handleMicClick, 
    startRecording, 
    stopRecording 
} from './audio';
