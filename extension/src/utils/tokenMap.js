/**
 * PromptShield Token Map Utility
 * Maintains reversible anonymisation with session consistency
 * Ensures same original value → same token within a session
 */

/**
 * Session Token Map
 * Stored in memory only (service worker globals)
 * Cleared on browser restart or explicit reset
 */
export class SessionTokenMap {
    constructor() {
        this.map = new Map(); // original value → token
        this.reverseMap = new Map(); // token → original value
        this.categoryCounters = new Map(); // category → counter
    }

    /**
     * Get or create a token for a value
     * Ensures session consistency
     * 
     * @param {string} originalValue - The sensitive value to tokenize
     * @param {string} category - Category (PHI, PII, SECRET, FINANCIAL, CUSTOM)
     * @returns {string} Consistent token like [PHI_1]
     */
    getToken(originalValue, category = 'UNKNOWN') {
        // Check if already tokenized
        if (this.map.has(originalValue)) {
            return this.map.get(originalValue);
        }

        // Generate new token with counter
        const counter = (this.categoryCounters.get(category) || 0) + 1;
        this.categoryCounters.set(category, counter);

        const token = `[${category}_${counter}]`;

        // Store both directions for de-anonymization
        this.map.set(originalValue, token);
        this.reverseMap.set(token, originalValue);

        return token;
    }

    /**
     * Get original value from token
     * 
     * @param {string} token - The token like [PHI_1]
     * @returns {string|null} Original value or null if not found
     */
    getOriginalValue(token) {
        return this.reverseMap.get(token) || null;
    }

    /**
     * Check if a value has been tokenized
     * 
     * @param {string} originalValue - Value to check
     * @returns {boolean} True if tokenized
     */
    hasValue(originalValue) {
        return this.map.has(originalValue);
    }

    /**
     * Get all current mappings
     * WARNING: Contains sensitive data
     * Only use for audit/logging purposes
     */
    getAllMappings() {
        return {
            forward: new Map(this.map),
            reverse: new Map(this.reverseMap)
        };
    }

    /**
     * Replace all tokens in text with original values
     * Performs the de-anonymization operation
     * 
     * @param {string} text - Text containing tokens
     * @returns {string} Text with original values restored
     */
    deanonymize(text) {
        let result = text;

        for (const [token, original] of this.reverseMap) {
            // Use word boundary to avoid partial replacements
            const regex = new RegExp(escapeRegex(token), 'g');
            result = result.replace(regex, original);
        }

        return result;
    }

    /**
     * Count tokens by category
     * Useful for statistics
     */
    getCountByCategory() {
        return new Map(this.categoryCounters);
    }

    /**
     * Clear all mappings
     * Called at session end or when user requests reset
     */
    clear() {
        this.map.clear();
        this.reverseMap.clear();
        this.categoryCounters.clear();
    }

    /**
     * Get session statistics
     */
    getStats() {
        return {
            totalTokens: this.map.size,
            countByCategory: Object.fromEntries(this.categoryCounters),
            allMappings: Array.from(this.map.entries()).map(([original, token]) => ({
                original,
                token
            }))
        };
    }

    /**
     * Check for suspicious de-anonymization attempts
     * Detects patterns like "what is behind [PHI_1]?" or "reveal [PERSON_1]"
     * 
     * @param {string} text - Text to scan
     * @returns {Array} Array of suspicious patterns found
     */
    detectDeanonymizationAttempts(text) {
        const suspiciousPatterns = [
            /reveal.*?\[[\w_]+_\d+\]/gi,
            /what.*?is.*?\[[\w_]+_\d+\]/gi,
            /original.*?\[[\w_]+_\d+\]/gi,
            /translate.*?\[[\w_]+_\d+\]/gi,
            /decode.*?\[[\w_]+_\d+\]/gi,
            /guess.*?\[[\w_]+_\d+\]/gi,
            /figure out.*?\[[\w_]+_\d+\]/gi,
            /\[[\w_]+_\d+\].*?(?:is|was|actually|really|supposed to be)/gi
        ];

        const attempts = [];

        for (const pattern of suspiciousPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                attempts.push({
                    pattern: match[0],
                    type: pattern.source,
                    position: match.index
                });
            }
        }

        return attempts;
    }

    /**
     * Create a safe JSON representation (without actual sensitive values)
     * For audit logs and reporting
     */
    toAuditSafeJSON() {
        const stats = {
            totalTokens: this.map.size,
            countByCategory: Object.fromEntries(this.categoryCounters),
            tokenizedValues: Array.from(this.map.entries()).map(([, token]) => token)
        };
        return stats;
    }
}

/**
 * Global session token map instance
 * Lives in service worker memory, cleared on restart
 */
export let globalSessionTokenMap = new SessionTokenMap();

/**
 * Reset the global token map
 * Called at session start or when user clears data
 */
export function resetSessionTokenMap() {
    globalSessionTokenMap = new SessionTokenMap();
}

/**
 * Escape regex special characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get current global token map
 */
export function getSessionTokenMap() {
    return globalSessionTokenMap;
}
