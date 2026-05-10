/**
 * PromptShield Background Service Worker
 * Manages: mode state, policy, rules, session token map, audit logging, message routing
 */

import { SessionTokenMap, resetSessionTokenMap, getSessionTokenMap } from './src/utils/tokenMap.js';
import { RulesEngine } from './src/rules/engine.js';
import { logAuditEvent, AUDIT_EVENT_TYPES, logModeChangeEvent, logDetectionEvent } from './src/utils/audit.js';

// ============================================================================
// Global State
// ============================================================================

let currentState = {
    mode: 'warn', // 'shadow', 'fix', 'warn'
    policy: 'hipaa', // 'hipaa', 'gdpr', 'pci', 'strict'
    isPaused: false,
    sessionId: generateSessionId(),
    userId: null,
    orgId: null
};

let rulesEngine = new RulesEngine();
let sessionTokenMap = null;

// Ensure sessionTokenMap is initialized
function ensureSessionTokenMapInitialized() {
    if (!sessionTokenMap) {
        sessionTokenMap = getSessionTokenMap();
    }
}

// ============================================================================
// Service Worker Initialization
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
    console.log('PromptShield installed');

    // Initialize storage with defaults
    chrome.storage.sync.set({
        mode: 'warn',
        policy: 'hipaa',
        isPaused: false
    });

    chrome.storage.local.set({
        personalRules: [],
        detectionStats: {}
    });

    // Reset session token map
    resetSessionTokenMap();
    sessionTokenMap = getSessionTokenMap();

    // Open onboarding/welcome page
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
});

// Load initial state from storage
chrome.storage.sync.get(['mode', 'policy', 'isPaused'], (result) => {
    if (result.mode) currentState.mode = result.mode;
    if (result.policy) currentState.policy = result.policy;
    if (result.isPaused !== undefined) currentState.isPaused = result.isPaused;
});

// Load personal rules from storage
chrome.storage.local.get(['personalRules'], (result) => {
    if (result.personalRules) {
        rulesEngine.setPersonalRules(result.personalRules);
    }
});

// ============================================================================
// Message Listener
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        try {
            switch (request.type) {
                case 'GET_STATE':
                    ensureSessionTokenMapInitialized();
                    return sendResponse({
                        state: currentState,
                        sessionTokenMapStats: sessionTokenMap.getStats()
                    });

                case 'SET_MODE':
                    const oldMode = currentState.mode;
                    currentState.mode = request.mode;
                    chrome.storage.sync.set({ mode: request.mode });

                    // Log mode change
                    await logModeChangeEvent(oldMode, request.mode, {
                        userId: currentState.userId,
                        orgId: currentState.orgId,
                        sessionId: currentState.sessionId,
                        adminUser: false
                    });

                    updateBadge();
                    return sendResponse({ success: true, mode: request.mode });

                case 'SET_POLICY':
                    currentState.policy = request.policy;
                    chrome.storage.sync.set({ policy: request.policy });
                    return sendResponse({ success: true, policy: request.policy });

                case 'TOGGLE_PAUSE':
                    currentState.isPaused = !currentState.isPaused;
                    chrome.storage.sync.set({ isPaused: currentState.isPaused });
                    updateBadge();
                    return sendResponse({ success: true, isPaused: currentState.isPaused });

                case 'LOG_EVENT':
                    await logAuditEvent({
                        eventType: request.eventType || AUDIT_EVENT_TYPES.DETECTION,
                        mode: currentState.mode,
                        detectionCount: request.detectionCount || 0,
                        categories: request.categories || [],
                        maxSeverity: request.maxSeverity || 'low',
                        aiTool: request.aiTool,
                        userId: currentState.userId,
                        orgId: currentState.orgId,
                        sessionId: currentState.sessionId,
                        actionTaken: request.actionTaken,
                        contextMetadata: request.contextMetadata
                    });
                    return sendResponse({ success: true });

                case 'GET_RULES':
                    const allRules = rulesEngine.orgRules.concat(rulesEngine.personalRules);
                    return sendResponse({
                        orgRules: rulesEngine.orgRules,
                        personalRules: rulesEngine.personalRules,
                        stats: rulesEngine.getStats()
                    });

                case 'SAVE_RULES':
                    rulesEngine.setPersonalRules(request.rules || []);
                    chrome.storage.local.set({ personalRules: request.rules || [] });
                    return sendResponse({ success: true });

                case 'GET_DETECTION_STATS':
                    let stats = {};
                    chrome.storage.local.get('detectionStats', (result) => {
                        stats = result.detectionStats || {};
                    });
                    return sendResponse(stats);

                case 'UPDATE_DETECTION_STATS':
                    chrome.storage.local.get('detectionStats', (result) => {
                        const stats = result.detectionStats || {};
                        const today = new Date().toISOString().split('T')[0];

                        if (!stats[today]) {
                            stats[today] = {
                                detections: 0,
                                masked: 0,
                                blocked: 0,
                                categories: {}
                            };
                        }

                        stats[today].detections += request.count || 0;
                        stats[today].masked += request.masked || 0;
                        stats[today].blocked += request.blocked || 0;

                        for (const [cat, count] of Object.entries(request.categories || {})) {
                            stats[today].categories[cat] = (stats[today].categories[cat] || 0) + count;
                        }

                        chrome.storage.local.set({ detectionStats: stats });
                    });
                    return sendResponse({ success: true });

                case 'GET_SESSION_TOKEN_MAP':
                    ensureSessionTokenMapInitialized();
                    return sendResponse(sessionTokenMap.getStats());

                case 'CLEAR_SESSION_TOKEN_MAP':
                    resetSessionTokenMap();
                    sessionTokenMap = getSessionTokenMap();
                    return sendResponse({ success: true });

                case 'DETECT_DEANONYMIZATION_ATTEMPT':
                    ensureSessionTokenMapInitialized();
                    const attempts = sessionTokenMap.detectDeanonymizationAttempts(request.text);
                    return sendResponse({
                        attempts: attempts,
                        blocked: attempts.length > 0
                    });

                default:
                    return sendResponse({ error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Message handler error:', error);
            return sendResponse({ error: error.message });
        }
    })();

    // Return true to indicate we will send response asynchronously
    return true;
});

// ============================================================================
// Badge Updates
// ============================================================================

function updateBadge() {
    if (currentState.isPaused) {
        chrome.action.setBadgeText({ text: '⏸' });
        chrome.action.setBadgeBackgroundColor({ color: '#999' });
    } else {
        chrome.action.setBadgeText({ text: currentState.mode[0].toUpperCase() });

        // Color by mode
        const modeColors = {
            'shadow': '#4285F4',   // Blue
            'fix': '#34A853',      // Green
            'warn': '#EA4335'      // Red
        };

        chrome.action.setBadgeBackgroundColor({ color: modeColors[currentState.mode] || '#4285F4' });
    }
}

// ============================================================================
// Utilities
// ============================================================================

function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize badge
updateBadge();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        if (changes.mode) {
            currentState.mode = changes.mode.newValue;
            updateBadge();
        }
        if (changes.policy) {
            currentState.policy = changes.policy.newValue;
        }
        if (changes.isPaused) {
            currentState.isPaused = changes.isPaused.newValue;
            updateBadge();
        }
    }
});

// ============================================================================
// Periodic Tasks
// ============================================================================

// Sync org rules from Supabase every minute (when not paused)
setInterval(async () => {
    if (!currentState.isPaused && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('org_rules')
                .select('*')
                .eq('enabled', true);

            if (!error && data) {
                rulesEngine.setOrgRules(data);
            }
        } catch (error) {
            console.error('Error syncing org rules:', error);
        }
    }
}, 60000);

// Clear session token map on new day
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        resetSessionTokenMap();
        sessionTokenMap = getSessionTokenMap();
        console.log('Session token map cleared (new day)');
    }
}, 60000);
