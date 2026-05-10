/**
 * PromptShield Audit Trail Utility
 * Logs events to Supabase without exposing raw sensitive data
 */

/**
 * Audit event types
 */
export const AUDIT_EVENT_TYPES = {
    DETECTION: 'detection',
    MASKED: 'masked',
    BLOCKED: 'blocked',
    ALLOWED: 'allowed',
    ALERT: 'alert',
    POLICY_CHANGED: 'policy_changed',
    RULE_CREATED: 'rule_created',
    RULE_UPDATED: 'rule_updated',
    RULE_DELETED: 'rule_deleted',
    MODE_CHANGED: 'mode_changed'
};

/**
 * Log an event to Supabase audit trail
 * IMPORTANT: Never sends raw prompt content or sensitive values
 * Only metadata: type, count, severity, category, timestamp, mode
 * 
 * @param {Object} eventData - Event to log
 * @returns {Promise<boolean>} Success/failure
 */
export async function logAuditEvent(eventData) {
    try {
        // Build safe audit event (no raw data)
        const safeEvent = {
            event_type: eventData.eventType || AUDIT_EVENT_TYPES.DETECTION,
            mode: eventData.mode,
            detection_count: eventData.detectionCount || 0,
            categories_found: eventData.categories || [],
            max_severity: eventData.maxSeverity || 'low',
            ai_tool: eventData.aiTool,
            timestamp: new Date().toISOString(),
            user_id: eventData.userId,
            org_id: eventData.orgId,
            session_id: eventData.sessionId,
            action_taken: eventData.actionTaken, // 'masked', 'blocked', 'allowed', 'warned'
            context_metadata: eventData.contextMetadata // Additional non-sensitive context
        };

        // Only log if we have Supabase connection
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('audit_events')
                .insert([safeEvent]);

            if (error) {
                console.error('Audit log error:', error);
                return false;
            }
        } else {
            // Fallback: log to localStorage if Supabase unavailable
            const events = JSON.parse(localStorage.getItem('promptshield_local_audit') || '[]');
            events.push(safeEvent);
            localStorage.setItem('promptshield_local_audit', JSON.stringify(events.slice(-100))); // Keep last 100
        }

        return true;
    } catch (error) {
        console.error('Error logging audit event:', error);
        return false;
    }
}

/**
 * Log a detection event
 * Called after detection scan completes
 * 
 * @param {Array} detections - Detection array from engine
 * @param {string} mode - Current mode (shadow/fix/warn)
 * @param {Object} context - Additional context
 */
export async function logDetectionEvent(detections, mode, context = {}) {
    if (detections.length === 0) return;

    const categories = [...new Set(detections.map(d => d.category))];
    const severities = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const det of detections) {
        severities[det.severity] = (severities[det.severity] || 0) + 1;
    }

    const maxSeverity = severities.critical > 0
        ? 'critical'
        : severities.high > 0
            ? 'high'
            : severities.medium > 0
                ? 'medium'
                : 'low';

    return logAuditEvent({
        eventType: AUDIT_EVENT_TYPES.DETECTION,
        mode,
        detectionCount: detections.length,
        categories,
        maxSeverity,
        aiTool: context.aiTool,
        userId: context.userId,
        orgId: context.orgId,
        sessionId: context.sessionId,
        actionTaken: 'detected',
        contextMetadata: {
            textLength: context.textLength,
            hasRules: context.hasRules || false,
            rulesApplied: context.rulesApplied || 0
        }
    });
}

/**
 * Log a masking event
 * Called when sensitive data is masked
 */
export async function logMaskingEvent(detections, mode, context = {}) {
    return logAuditEvent({
        eventType: AUDIT_EVENT_TYPES.MASKED,
        mode,
        detectionCount: detections.length,
        categories: [...new Set(detections.map(d => d.category))],
        maxSeverity: getMaxSeverity(detections),
        aiTool: context.aiTool,
        userId: context.userId,
        orgId: context.orgId,
        sessionId: context.sessionId,
        actionTaken: 'masked',
        contextMetadata: {
            userConfirmed: context.userConfirmed || false,
            automaticMask: context.automaticMask || false
        }
    });
}

/**
 * Log a blocked event
 * Called when user blocks a prompt
 */
export async function logBlockedEvent(detections, reason, context = {}) {
    return logAuditEvent({
        eventType: AUDIT_EVENT_TYPES.BLOCKED,
        mode: context.mode,
        detectionCount: detections.length,
        categories: [...new Set(detections.map(d => d.category))],
        maxSeverity: getMaxSeverity(detections),
        aiTool: context.aiTool,
        userId: context.userId,
        orgId: context.orgId,
        sessionId: context.sessionId,
        actionTaken: 'blocked',
        contextMetadata: {
            blockReason: reason,
            highSeverity: detections.some(d => d.severity === 'critical' || d.severity === 'high')
        }
    });
}

/**
 * Log a mode change
 * Called when user switches protection modes
 */
export async function logModeChangeEvent(oldMode, newMode, context = {}) {
    return logAuditEvent({
        eventType: AUDIT_EVENT_TYPES.MODE_CHANGED,
        mode: newMode,
        userId: context.userId,
        orgId: context.orgId,
        sessionId: context.sessionId,
        contextMetadata: {
            previousMode: oldMode,
            timestamp: new Date().toISOString(),
            userInitiated: true
        }
    });
}

/**
 * Log a policy change
 * Called when policy is updated
 */
export async function logPolicyChangeEvent(oldPolicy, newPolicy, context = {}) {
    return logAuditEvent({
        eventType: AUDIT_EVENT_TYPES.POLICY_CHANGED,
        userId: context.userId,
        orgId: context.orgId,
        sessionId: context.sessionId,
        contextMetadata: {
            previousPolicy: oldPolicy,
            newPolicy: newPolicy,
            changedBy: context.adminUser ? 'admin' : 'user',
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Helper to get max severity from detections
 */
function getMaxSeverity(detections) {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    let max = 0;
    let maxSeverity = 'low';

    for (const det of detections) {
        const score = severityOrder[det.severity] || 0;
        if (score > max) {
            max = score;
            maxSeverity = det.severity;
        }
    }

    return maxSeverity;
}

/**
 * Retrieve audit events with filtering
 * Used by dashboard for audit log display
 */
export async function getAuditEvents(filters = {}) {
    try {
        if (!window.supabaseClient) return [];

        let query = window.supabaseClient.from('audit_events').select('*');

        if (filters.startDate) {
            query = query.gte('timestamp', filters.startDate);
        }

        if (filters.endDate) {
            query = query.lte('timestamp', filters.endDate);
        }

        if (filters.mode) {
            query = query.eq('mode', filters.mode);
        }

        if (filters.eventType) {
            query = query.eq('event_type', filters.eventType);
        }

        if (filters.userId) {
            query = query.eq('user_id', filters.userId);
        }

        if (filters.severity) {
            query = query.eq('max_severity', filters.severity);
        }

        query = query.order('timestamp', { ascending: false }).limit(1000);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching audit events:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error retrieving audit events:', error);
        return [];
    }
}

/**
 * Get audit statistics
 */
export async function getAuditStats(filters = {}) {
    try {
        const events = await getAuditEvents(filters);

        const stats = {
            totalEvents: events.length,
            eventsByType: {},
            eventsByMode: {},
            eventsBySeverity: {},
            totalDetections: 0,
            totalMasked: 0,
            totalBlocked: 0,
            categoriesFound: {}
        };

        for (const event of events) {
            stats.eventsByType[event.event_type] = (stats.eventsByType[event.event_type] || 0) + 1;
            stats.eventsByMode[event.mode] = (stats.eventsByMode[event.mode] || 0) + 1;
            stats.eventsBySeverity[event.max_severity] = (stats.eventsBySeverity[event.max_severity] || 0) + 1;

            stats.totalDetections += event.detection_count || 0;

            if (event.action_taken === 'masked') {
                stats.totalMasked += event.detection_count || 0;
            }

            if (event.action_taken === 'blocked') {
                stats.totalBlocked += event.detection_count || 0;
            }

            for (const cat of (event.categories_found || [])) {
                stats.categoriesFound[cat] = (stats.categoriesFound[cat] || 0) + 1;
            }
        }

        return stats;
    } catch (error) {
        console.error('Error calculating audit stats:', error);
        return null;
    }
}

/**
 * Export audit events to CSV
 */
export function exportAuditEventsToCSV(events) {
    if (!events || events.length === 0) {
        console.warn('No events to export');
        return '';
    }

    // CSV headers
    const headers = [
        'Timestamp',
        'Event Type',
        'Mode',
        'Detection Count',
        'Categories',
        'Severity',
        'Action Taken',
        'AI Tool',
        'User ID'
    ];

    // CSV rows
    const rows = events.map(event => [
        event.timestamp,
        event.event_type,
        event.mode,
        event.detection_count,
        (event.categories_found || []).join('; '),
        event.max_severity,
        event.action_taken,
        event.ai_tool || 'unknown',
        event.user_id
    ]);

    // Build CSV
    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');

    return csv;
}
