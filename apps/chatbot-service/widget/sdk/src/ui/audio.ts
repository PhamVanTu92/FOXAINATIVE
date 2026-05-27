/**
 * FoxAI Widget SDK - Audio Recording Module
 * @module ui/audio
 */

import { state } from '../core/state';
import { DEFAULT_SPEECH_LANG } from '../core/constants';
import { createLogger } from '../utils/helpers';

const logger = createLogger('Audio');

/** UI element references for audio module */
interface AudioUIElements {
    micButton: HTMLButtonElement | null;
    input: HTMLTextAreaElement | null;
    sendButton: HTMLButtonElement | null;
}

let elements: AudioUIElements = {
    micButton: null,
    input: null,
    sendButton: null,
};

/** Original input value before recording starts */
let originalInputValue = '';

/** Final transcript accumulated during recording */
let finalTranscript = '';

/**
 * Initialize audio module with UI elements
 * @param uiElements - UI element references
 */
export function initAudio(uiElements: AudioUIElements): void {
    elements = uiElements;
}

/**
 * Handle microphone button click
 * Toggles between start and stop recording
 */
export function handleMicClick(): void {
    logger.log('Mic button clicked, isRecording:', state.isRecording);
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

/**
 * Start Speech Recognition for voice input
 * Uses browser's built-in speech recognition with real-time streaming
 */
export function startRecording(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('Browser does not support speech recognition');
        logger.warn('Speech Recognition not supported');
        return;
    }
    
    if (!state.recognition) {
        initializeSpeechRecognition(SpeechRecognition);
    }
    
    try {
        state.recognition?.start();
        logger.log('Speech recognition started');
    } catch (error) {
        logger.error('Failed to start speech recognition:', error);
        alert('Failed to start recording: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Initialize Speech Recognition instance with event handlers
 * @param SpeechRecognition - Speech Recognition constructor
 */
function initializeSpeechRecognition(SpeechRecognition: any): void {
    state.recognition = new SpeechRecognition();
    state.recognition!.lang = DEFAULT_SPEECH_LANG;
    state.recognition!.interimResults = true; // Enable real-time streaming
    state.recognition!.continuous = false; // Auto-stop when silent
    
    state.recognition!.onstart = handleRecordingStart;
    state.recognition!.onresult = handleRecognitionResult;
    state.recognition!.onerror = handleRecognitionError;
    state.recognition!.onend = handleRecordingEnd;
}

/**
 * Handle recording start event
 */
function handleRecordingStart(): void {
    logger.log('Speech recognition started');
    state.isRecording = true;
    elements.micButton?.classList.add('recording');
    
    // Store original input value for appending
    originalInputValue = elements.input?.value || '';
    if (originalInputValue && !originalInputValue.endsWith(' ')) {
        originalInputValue += ' ';
    }
    finalTranscript = '';
}

/**
 * Handle speech recognition results with real-time streaming
 * @param event - Speech recognition result event
 */
function handleRecognitionResult(event: any): void {
    let interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
        } else {
            interimTranscript += transcript;
        }
    }
    
    // Update input with real-time streaming
    if (elements.input) {
        elements.input.value = originalInputValue + finalTranscript + interimTranscript;
        autoResizeTextarea();
    }
    
    logger.log('Transcript update - Final:', finalTranscript, 'Interim:', interimTranscript);
}

/**
 * Handle speech recognition errors
 * @param event - Speech recognition error event
 */
function handleRecognitionError(event: any): void {
    logger.error('Speech recognition error:', event.error);
    
    if (event.error !== 'no-speech') {
        state.isRecording = false;
        elements.micButton?.classList.remove('recording');
        
        if (event.error === 'not-allowed') {
            alert('Please allow microphone access to use voice input.');
        } else if (event.error === 'service-not-allowed') {
            alert('Please enable speech recognition in your browser settings.');
        } else {
            alert('Speech recognition error: ' + event.error);
        }
    }
}

/**
 * Handle recording end event
 */
function handleRecordingEnd(): void {
    logger.log('Speech recognition ended');
    state.isRecording = false;
    elements.micButton?.classList.remove('recording');
}

/**
 * Auto-resize textarea based on content
 */
function autoResizeTextarea(): void {
    if (elements.input) {
        elements.input.style.height = 'auto';
        elements.input.style.height = elements.input.scrollHeight + 'px';
        elements.input.scrollTop = elements.input.scrollHeight;
    }
}

/**
 * Stop speech recognition and cleanup
 */
export function stopRecording(): void {
    if (state.recognition && state.isRecording) {
        logger.log('Stopping speech recognition...');
        state.isRecording = false;
        state.recognition.stop();
        elements.micButton?.classList.remove('recording');
    }
}
