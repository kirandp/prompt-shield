/**
 * PromptShield Detection Engine
 * Core detection, highlighting, and masking functionality
 */

import { getAllPatternObjects } from './patterns.js';

/**
 * Detection type definition
 */
export class Detection {
    constructor(id, text, start, end, patternId, category, severity, type = 'regex', isAI = false) {
        this.id = id;
        this.text = text;
        this.start = start;
        this.end = end;
        this.patternId = patternId;
        this.category = category;
        this.severity = severity;
        this.type = type; // 'regex' or 'rule' or 'ai'
        this.isAI = isAI;
    }
}

/**
 * Scan text with all regex patterns
 * Returns sorted, non-overlapping Detection[] array
 * 
 * @param {string} text - Text to scan
 * @returns {Detection[]} Array of detections
 */
export function regexScan(text) {
    const detections = [];
    const patterns = getAllPatternObjects();

    for (const patternObj of patterns) {
        const regex = patternObj.pattern;

        // Reset lastIndex for global patterns
        if (regex.global) {
            regex.lastIndex = 0;
        }

        let match;
        while ((match = regex.exec(text)) !== null) {
            const matchText = match[0];
            const start = match.index;
            const end = start + matchText.length;

            // Generate unique ID
            const id = `${patternObj.id}_${start}`;

            detections.push(
                new Detection(
                    id,
                    matchText,
                    start,
                    end,
                    patternObj.id,
                    patternObj.category,
                    patternObj.severity,
                    'regex',
                    false
                )
            );
        }
    }

    // Sort by start position and remove overlaps
    return deduplicateOverlaps(detections.sort((a, b) => a.start - b.start));
}

/**
 * Remove overlapping detections, keeping the first one
 * 
 * @param {Detection[]} detections - Array of detections
 * @returns {Detection[]} De-duplicated array
 */
function deduplicateOverlaps(detections) {
    const result = [];

    for (const det of detections) {
        let overlaps = false;

        for (const existing of result) {
            if (!(det.end <= existing.start || det.start >= existing.end)) {
                overlaps = true;
                break;
            }
        }

        if (!overlaps) {
            result.push(det);
        }
    }

    return result;
}

/**
 * Apply custom rules on top of base detections
 * Rules can match exact strings, patterns, or categories
 * 
 * @param {string} text - Text to scan
 * @param {Detection[]} baseDetections - Base regex detections
 * @param {Array} rules - Custom rules array
 * @returns {Detection[]} Combined, de-duplicated detections
 */
export function applyRules(text, baseDetections, rules = []) {
    const ruleDetections = [];

    for (const rule of rules) {
        if (!rule.enabled) continue;

        try {
            if (rule.type === 'exact') {
                // Exact string matching
                const searchText = rule.caseSensitive ? text : text.toLowerCase();
                const matchText = rule.caseSensitive ? rule.match : rule.match.toLowerCase();
                let index = 0;

                while ((index = searchText.indexOf(matchText, index)) !== -1) {
                    const id = `RULE_${rule.id}_${index}`;
                    ruleDetections.push(
                        new Detection(
                            id,
                            text.substring(index, index + matchText.length),
                            index,
                            index + matchText.length,
                            rule.id,
                            'CUSTOM',
                            'high',
                            'rule',
                            false
                        )
                    );
                    index += matchText.length;
                }
            } else if (rule.type === 'regex') {
                // Regex pattern matching
                const regex = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');
                let match;

                while ((match = regex.exec(text)) !== null) {
                    const id = `RULE_${rule.id}_${match.index}`;
                    ruleDetections.push(
                        new Detection(
                            id,
                            match[0],
                            match.index,
                            match.index + match[0].length,
                            rule.id,
                            'CUSTOM',
                            'high',
                            'rule',
                            false
                        )
                    );
                }
            }
        } catch (error) {
            console.error(`Error applying rule ${rule.id}:`, error);
        }
    }

    // Merge base detections and rule detections
    const combined = [...baseDetections, ...ruleDetections];

    // Re-sort and de-duplicate
    return deduplicateOverlaps(combined.sort((a, b) => a.start - b.start));
}

/**
 * Build masked string with tokens replacing detected content
 * 
 * @param {string} text - Original text
 * @param {Detection[]} detections - Array of detections
 * @param {Map} tokenMap - Map of original values to tokens (for consistency)
 * @returns {Object} { masked: string, tokenMap: Map, replacements: Array }
 */
export function buildMasked(text, detections, tokenMap = new Map()) {
    if (detections.length === 0) {
        return { masked: text, tokenMap, replacements: [] };
    }

    const replacements = [];
    let maskedText = '';
    let lastEnd = 0;

    // Sort detections by start position
    const sorted = [...detections].sort((a, b) => a.start - b.start);

    for (const det of sorted) {
        // Add text before this detection
        maskedText += text.substring(lastEnd, det.start);

        // Generate or retrieve token
        let token;
        if (tokenMap.has(det.text)) {
            token = tokenMap.get(det.text);
        } else {
            // Generate new token based on category and counter
            const key = `${det.category}_COUNT`;
            const count = tokenMap.get(key) || 0;
            token = `[${det.category}_${count + 1}]`;
            tokenMap.set(key, count + 1);
            tokenMap.set(det.text, token);
        }

        maskedText += token;
        replacements.push({
            original: det.text,
            token: token,
            start: lastEnd + (det.start - lastEnd),
            detection: det
        });

        lastEnd = det.end;
    }

    // Add remaining text
    maskedText += text.substring(lastEnd);

    return { masked: maskedText, tokenMap, replacements };
}

/**
 * Build highlighted HTML with <mark> spans colored by type
 * 
 * @param {string} text - Original text
 * @param {Detection[]} detections - Array of detections
 * @returns {string} HTML string with highlighted spans
 */
export function buildHighlighted(text, detections) {
    if (detections.length === 0) {
        return `<div class="highlighted-text">${escapeHtml(text)}</div>`;
    }

    const sorted = [...detections].sort((a, b) => a.start - b.start);
    let html = '<div class="highlighted-text">';
    let lastEnd = 0;

    const colorMap = {
        'PHI': '#FCEBEB',
        'PII': '#FAEEDA',
        'SECRET': '#EEEDFE',
        'FINANCIAL': '#E1F5EE',
        'CUSTOM': '#FFF3CD'
    };

    for (const det of sorted) {
        // Add text before this detection
        html += escapeHtml(text.substring(lastEnd, det.start));

        // Add highlighted span
        const bgColor = colorMap[det.category] || '#E8E8E8';
        const textColor = getCategoryTextColor(det.category);
        html += `<mark class="detection detection-${det.category.toLowerCase()}" 
              style="background-color: ${bgColor}; color: ${textColor}; padding: 2px 4px; border-radius: 3px;" 
              title="${det.patternId}: ${det.text}">
              ${escapeHtml(det.text)}
            </mark>`;

        lastEnd = det.end;
    }

    // Add remaining text
    html += escapeHtml(text.substring(lastEnd));
    html += '</div>';

    return html;
}

/**
 * Get appropriate text color for category background
 */
function getCategoryTextColor(category) {
    const colorMap = {
        'PHI': '#A32D2D',
        'PII': '#633806',
        'SECRET': '#3C3489',
        'FINANCIAL': '#085041',
        'CUSTOM': '#664d03'
    };
    return colorMap[category] || '#000000';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * De-anonymize response by replacing tokens back to original values
 * 
 * @param {string} response - AI response containing tokens
 * @param {Map} tokenMap - Token to original value mapping
 * @returns {string} Response with tokens replaced back to original values
 */
export function deanonymizeResponse(response, tokenMap) {
    let result = response;

    for (const [original, token] of tokenMap) {
        if (original !== 'PHI_COUNT' && original !== 'PII_COUNT' &&
            original !== 'SECRET_COUNT' && original !== 'FINANCIAL_COUNT' &&
            original !== 'CUSTOM_COUNT' && !original.endsWith('_COUNT')) {

            // Replace all occurrences of token with original value
            const regex = new RegExp(escapeRegex(token), 'g');
            result = result.replace(regex, original);
        }
    }

    return result;
}

/**
 * Escape regex special characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Call Claude API for semantic detection
 * Only fires if text.length > 100 and base detections < 2
 * 
 * @param {string} text - Text to analyze
 * @param {Array} baseDetections - Base regex detections
 * @returns {Promise<Detection[]>} AI-detected items
 */
export async function aiDetect(text, baseDetections = []) {
    // Only run semantic detection on substantial text with few detections
    if (text.length < 100 || baseDetections.length >= 2) {
        return [];
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                system: `You are a data detection AI. Analyze text for sensitive data.
Return a JSON array of detections with: {text, category, severity}.
Categories: PHI (health), PII (personal), SECRET (credentials), FINANCIAL.
Severities: critical, high, medium, low.
Be conservative - only flag items you're confident about.`,
                messages: [
                    {
                        role: 'user',
                        content: `Detect sensitive data in this text:\n\n${text}\n\nReturn only valid JSON array, no other text.`
                    }
                ]
            })
        });

        if (!response.ok) {
            console.error('Claude API error:', response.status);
            return [];
        }

        const data = await response.json();
        const content = data.content[0].text;

        // Parse JSON response
        const detected = JSON.parse(content);
        const detections = [];

        for (const item of detected) {
            const index = text.indexOf(item.text);
            if (index >= 0) {
                detections.push(
                    new Detection(
                        `AI_${Math.random()}`,
                        item.text,
                        index,
                        index + item.text.length,
                        'AI_DETECTED',
                        item.category,
                        item.severity,
                        'ai',
                        true
                    )
                );
            }
        }

        return detections;
    } catch (error) {
        console.error('AI detection error:', error);
        return [];
    }
}

/**
 * Get summary statistics from detections
 */
export function getDetectionStats(detections) {
    const stats = {
        total: detections.length,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {},
        byType: { regex: 0, rule: 0, ai: 0 }
    };

    for (const det of detections) {
        stats.bySeverity[det.severity] = (stats.bySeverity[det.severity] || 0) + 1;
        stats.byCategory[det.category] = (stats.byCategory[det.category] || 0) + 1;
        stats.byType[det.type] = (stats.byType[det.type] || 0) + 1;
    }

    return stats;
}
