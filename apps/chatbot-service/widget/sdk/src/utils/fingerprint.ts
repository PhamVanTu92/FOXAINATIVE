/**
 * FoxAI Widget SDK - Browser Fingerprint Generator
 * @module utils/fingerprint
 */

/**
 * Generate unique browser fingerprint for user identification
 * Uses multiple browser characteristics to create a stable identifier
 * @returns Promise resolving to fingerprint hash string
 */
export async function generateFingerprint(): Promise<string> {
    const components: string[] = [
        // Screen properties
        `${screen.width}x${screen.height}x${screen.colorDepth}`,
        // Timezone
        String(new Date().getTimezoneOffset()),
        // Language & Platform
        navigator.language,
        navigator.platform,
        navigator.userAgent,
        String(navigator.hardwareConcurrency ?? 'unknown'),
    ];
    
    // Canvas fingerprint
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('FoxAI Widget', 2, 2);
            components.push(canvas.toDataURL());
        }
    } catch {
        components.push('canvas-blocked');
    }
    
    // WebGL fingerprint
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
        if (gl && 'getExtension' in gl) {
            const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const glContext = gl as WebGLRenderingContext;
                components.push(
                    glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string,
                    glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
                );
            }
        }
    } catch {
        components.push('webgl-blocked');
    }
    
    return hashString(components.join('|||'));
}

/**
 * Generate SHA-256 hash from string using Web Crypto API
 * Falls back to simple hash for unsupported browsers
 * @param str - String to hash
 * @returns Promise resolving to hash string
 */
async function hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    
    if (window.crypto?.subtle) {
        try {
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch {
            return fallbackHash(str);
        }
    }
    
    return fallbackHash(str);
}

/**
 * Fallback hash function for browsers without Web Crypto API
 * @param str - String to hash
 * @returns Hash string
 */
function fallbackHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
}
