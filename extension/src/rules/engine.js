/**
 * PromptShield Custom Rules Engine
 * Manages custom user and organization rules with priority ordering
 */

/**
 * Rule type definition
 */
export class Rule {
    constructor(
        id,
        name,
        type,
        pattern,
        replacement,
        category = null,
        scope = 'session',
        caseSensitive = false,
        enabled = true,
        match = null,
        isOrgRule = false,
        createdAt = new Date()
    ) {
        this.id = id;
        this.name = name;
        this.type = type; // 'exact' | 'regex' | 'category' | 'keyword'
        this.pattern = pattern; // For regex/keyword types
        this.match = match; // For exact type
        this.replacement = replacement;
        this.category = category; // For category type overrides
        this.scope = scope; // 'session' | 'always'
        this.caseSensitive = caseSensitive;
        this.enabled = enabled;
        this.isOrgRule = isOrgRule;
        this.createdAt = createdAt;
        this.hits = 0; // Counter
    }
}

/**
 * Rules engine managing priority and consistency
 */
export class RulesEngine {
    constructor() {
        this.orgRules = [];
        this.personalRules = [];
        this.sessionTokenMap = new Map(); // For session consistency
    }

    /**
     * Load organization rules (from Supabase)
     */
    setOrgRules(rules) {
        this.orgRules = rules || [];
    }

    /**
     * Load personal rules (from chrome.storage.local)
     */
    setPersonalRules(rules) {
        this.personalRules = rules || [];
    }

    /**
     * Add a new personal rule
     */
    addPersonalRule(rule) {
        rule.id = rule.id || `personal_${Date.now()}_${Math.random()}`;
        this.personalRules.push(rule);
        return rule;
    }

    /**
     * Update an existing personal rule
     */
    updatePersonalRule(ruleId, updates) {
        const index = this.personalRules.findIndex(r => r.id === ruleId);
        if (index >= 0) {
            this.personalRules[index] = { ...this.personalRules[index], ...updates };
            return this.personalRules[index];
        }
        return null;
    }

    /**
     * Delete a personal rule
     */
    deletePersonalRule(ruleId) {
        this.personalRules = this.personalRules.filter(r => r.id !== ruleId);
    }

    /**
     * Get all rules sorted by priority
     * Priority order:
     * 1. Org exact-match rules
     * 2. Personal exact-match rules
     * 3. Org category rules
     * 4. Personal category rules
     * 5. Org pattern rules
     * 6. Personal pattern rules
     */
    getAllRulesByPriority() {
        const prioritized = [];

        // 1. Org exact-match
        prioritized.push(
            ...this.orgRules.filter(r => r.enabled && r.type === 'exact' && r.isOrgRule)
        );

        // 2. Personal exact-match
        prioritized.push(
            ...this.personalRules.filter(r => r.enabled && r.type === 'exact' && !r.isOrgRule)
        );

        // 3. Org category
        prioritized.push(
            ...this.orgRules.filter(r => r.enabled && r.type === 'category' && r.isOrgRule)
        );

        // 4. Personal category
        prioritized.push(
            ...this.personalRules.filter(r => r.enabled && r.type === 'category' && !r.isOrgRule)
        );

        // 5. Org pattern
        prioritized.push(
            ...this.orgRules.filter(r => r.enabled && r.type === 'regex' && r.isOrgRule)
        );

        // 6. Personal pattern
        prioritized.push(
            ...this.personalRules.filter(r => r.enabled && r.type === 'regex' && !r.isOrgRule)
        );

        return prioritized;
    }

    /**
     * Apply rule to get replacement value
     * Maintains session consistency: same original → same replacement in a session
     */
    getReplacement(rule, originalValue) {
        // Session consistency check
        const sessionKey = `rule_${rule.id}_${originalValue}`;
        if (this.sessionTokenMap.has(sessionKey)) {
            return this.sessionTokenMap.get(sessionKey);
        }

        let replacement = rule.replacement;

        if (rule.type === 'category') {
            // Category replacements can have special patterns
            if (replacement === 'sequential') {
                const categoryKey = `${rule.category}_seq_count`;
                const count = (this.sessionTokenMap.get(categoryKey) || 0) + 1;
                this.sessionTokenMap.set(categoryKey, count);
                replacement = `${rule.category}_${count}`;
            } else if (replacement === 'preserve_first') {
                // Extract first word if it looks like a name
                const parts = originalValue.split(/[\s\-]/);
                replacement = parts.length > 1 ? `${parts[0]} [${rule.category}]` : replacement;
            }
        }

        // Store for session consistency
        this.sessionTokenMap.set(sessionKey, replacement);

        return replacement;
    }

    /**
     * Clear session token map (called at session end)
     */
    clearSessionTokenMap() {
        this.sessionTokenMap.clear();
    }

    /**
     * Validate a rule before saving
     */
    validateRule(rule) {
        const errors = [];

        if (!rule.name || rule.name.trim() === '') {
            errors.push('Rule name is required');
        }

        if (!rule.type || !['exact', 'regex', 'category', 'keyword'].includes(rule.type)) {
            errors.push('Invalid rule type');
        }

        if (rule.type === 'exact' && (!rule.match || rule.match.trim() === '')) {
            errors.push('Exact match value is required');
        }

        if (rule.type === 'regex') {
            try {
                new RegExp(rule.pattern);
            } catch (e) {
                errors.push(`Invalid regex pattern: ${e.message}`);
            }
        }

        if (rule.type === 'category' && !rule.category) {
            errors.push('Category is required for category rules');
        }

        if (!rule.replacement || rule.replacement.trim() === '') {
            errors.push('Replacement value is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Test a rule against sample text
     */
    testRule(rule, sampleText) {
        const matches = [];

        try {
            if (rule.type === 'exact') {
                const searchText = rule.caseSensitive ? sampleText : sampleText.toLowerCase();
                const matchText = rule.caseSensitive ? rule.match : rule.match.toLowerCase();
                let index = 0;

                while ((index = searchText.indexOf(matchText, index)) !== -1) {
                    matches.push({
                        text: sampleText.substring(index, index + matchText.length),
                        start: index,
                        end: index + matchText.length,
                        replacement: this.getReplacement(rule, sampleText.substring(index, index + matchText.length))
                    });
                    index += matchText.length;
                }
            } else if (rule.type === 'regex') {
                const regex = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');
                let match;

                while ((match = regex.exec(sampleText)) !== null) {
                    matches.push({
                        text: match[0],
                        start: match.index,
                        end: match.index + match[0].length,
                        replacement: this.getReplacement(rule, match[0])
                    });
                }
            } else if (rule.type === 'category') {
                // For category rules, just show the pattern description
                matches.push({
                    text: '[Category-based match]',
                    start: 0,
                    end: 0,
                    replacement: rule.replacement
                });
            } else if (rule.type === 'keyword') {
                // Keyword-context matching
                const keywords = rule.pattern.split('|').map(k => k.trim().toLowerCase());
                const words = sampleText.toLowerCase().split(/\s+/);

                for (let i = 0; i < words.length; i++) {
                    if (keywords.some(kw => words[i].includes(kw))) {
                        // Look for numbers near keyword
                        const context = sampleText.substring(
                            Math.max(0, sampleText.lastIndexOf(' ', i * 10) - 50),
                            Math.min(sampleText.length, i * 10 + 100)
                        );
                        const numberMatch = context.match(/\d+[-\s]?\d+/);

                        if (numberMatch) {
                            matches.push({
                                text: numberMatch[0],
                                start: -1, // Approximate
                                end: -1,
                                replacement: rule.replacement
                            });
                        }
                    }
                }
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                matches: []
            };
        }

        return {
            success: true,
            matches,
            count: matches.length
        };
    }

    /**
     * Get rule statistics
     */
    getStats() {
        return {
            orgRules: {
                total: this.orgRules.length,
                enabled: this.orgRules.filter(r => r.enabled).length,
                byType: this._countByType(this.orgRules)
            },
            personalRules: {
                total: this.personalRules.length,
                enabled: this.personalRules.filter(r => r.enabled).length,
                byType: this._countByType(this.personalRules)
            },
            totalHits: this.orgRules.concat(this.personalRules).reduce((sum, r) => sum + (r.hits || 0), 0)
        };
    }

    _countByType(rules) {
        const counts = { exact: 0, regex: 0, category: 0, keyword: 0 };
        for (const rule of rules) {
            counts[rule.type] = (counts[rule.type] || 0) + 1;
        }
        return counts;
    }
}

/**
 * Export default instance for singleton use
 */
export const rulesEngine = new RulesEngine();
