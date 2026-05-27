/**
 * FoxAI Widget SDK - LocalStorage Utilities
 * @module utils/storage
 */

import { STORAGE_PREFIX } from '../core/constants';

/**
 * Save value to localStorage with SDK prefix
 * @param key - Storage key
 * @param value - Value to store
 */
export function saveToStorage<T>(key: string, value: T): void {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
        console.warn('[FoxAI] Failed to save to localStorage:', e);
    }
}

/**
 * Get value from localStorage with SDK prefix
 * @param key - Storage key
 * @returns Stored value or null
 */
export function getFromStorage<T>(key: string): T | null {
    try {
        const value = localStorage.getItem(STORAGE_PREFIX + key);
        return value ? JSON.parse(value) as T : null;
    } catch (e) {
        console.warn('[FoxAI] Failed to get from localStorage:', e);
        return null;
    }
}

/**
 * Remove value from localStorage
 * @param key - Storage key
 */
export function removeFromStorage(key: string): void {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
        console.warn('[FoxAI] Failed to remove from localStorage:', e);
    }
}

/**
 * Clear all SDK-related localStorage entries
 */
export function clearStorage(): void {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('[FoxAI] Failed to clear localStorage:', e);
    }
}
