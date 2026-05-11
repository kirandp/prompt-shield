/**
 * Supabase Client Initialization
 *
 * The client is null when env vars are missing, so pages can render a
 * "not configured" state instead of crashing at import time.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Strip trailing slashes and a `/rest/v1` suffix if the user pasted the
// REST endpoint instead of the project URL — supabase-js adds `/rest/v1`
// itself, so leaving it on causes 404s like /rest/v1/rest/v1/<table>.
function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
    if (!raw) return raw;
    let url = raw.trim().replace(/\/+$/, '');
    url = url.replace(/\/rest\/v1$/, '');
    return url;
}

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey)
        : null;

export const isSupabaseConfigured = supabase !== null;

/**
 * Cache the demo org id so we can stamp audit events with it without
 * doing a lookup on every insert.
 */
let cachedDemoOrgId: string | null | undefined = undefined;

export async function getDemoOrgId(): Promise<string | null> {
    if (!supabase) return null;
    if (cachedDemoOrgId !== undefined) return cachedDemoOrgId;
    const { data } = await supabase
        .from('organisations')
        .select('id')
        .eq('domain', 'demo.promptshield.io')
        .maybeSingle();
    const resolved: string | null = data?.id ?? null;
    cachedDemoOrgId = resolved;
    return resolved;
}

export type AuditEventInsert = {
    event_type: string;
    mode?: string | null;
    detection_count?: number;
    categories_found?: string[];
    max_severity?: string | null;
    ai_tool?: string | null;
    action_taken?: string | null;
    session_id?: string | null;
    context_metadata?: Record<string, any> | null;
};

/**
 * Insert a single audit event. Fire-and-forget from the UI: returns the
 * inserted row on success, null on any failure (logged to console).
 *
 * Stamps `org_id` with the demo org so the row is visible under both the
 * anon DEMO read policy and authenticated demo users. No-op when
 * Supabase is not configured.
 */
export async function insertAuditEvent(payload: AuditEventInsert) {
    if (!supabase) return null;
    try {
        const org_id = await getDemoOrgId();
        const { data, error } = await supabase
            .from('audit_events')
            .insert([{ org_id, ...payload }])
            .select();
        if (error) {
            console.error('Failed to insert audit event:', error);
            return null;
        }
        return data?.[0] || null;
    } catch (e) {
        console.error('insertAuditEvent error:', e);
        return null;
    }
}

/**
 * Subscribe to real-time audit events. Returns an unsubscribe function.
 * Safe to call when Supabase is not configured (no-op).
 */
export function subscribeToAuditEvents(callback: (event: any) => void) {
    if (!supabase) return () => { };

    const subscription = supabase
        .channel('audit_events')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'audit_events' },
            callback
        )
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
}

/**
 * Subscribe to real-time rule updates
 */
export function subscribeToRules(callback: (event: any) => void) {
    if (!supabase) return () => { };

    const subscription = supabase
        .channel('org_rules')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'org_rules' },
            callback
        )
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
}

/**
 * Subscribe to policy updates
 */
export function subscribeToPolicies(callback: (event: any) => void) {
    if (!supabase) return () => { };

    const subscription = supabase
        .channel('policy_profiles')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'policy_profiles' },
            callback
        )
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
}

/**
 * Fetch all org rules for an organization
 */
export async function fetchOrgRules(orgId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('org_rules')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching org rules:', error);
        return [];
    }

    return data || [];
}

/**
 * Create a new org rule
 */
export async function createOrgRule(orgId: string, rule: any) {
    if (!supabase) throw new Error('Supabase is not configured');

    const { data, error } = await supabase
        .from('org_rules')
        .insert([
            {
                org_id: orgId,
                name: rule.name,
                description: rule.description,
                rule_type: rule.type,
                match_pattern: rule.match || rule.pattern,
                replacement: rule.replacement,
                case_sensitive: rule.caseSensitive || false,
                enabled: true,
            }
        ])
        .select();

    if (error) {
        console.error('Error creating org rule:', error);
        throw new Error(error.message || 'Failed to create rule');
    }

    return data?.[0] || null;
}

/**
 * Update an org rule
 */
export async function updateOrgRule(ruleId: number, updates: any) {
    if (!supabase) throw new Error('Supabase is not configured');

    const { data, error } = await supabase
        .from('org_rules')
        .update(updates)
        .eq('id', ruleId)
        .select();

    if (error) {
        console.error('Error updating org rule:', error);
        throw new Error(error.message || 'Failed to update rule');
    }

    return data?.[0] || null;
}

/**
 * Delete an org rule
 */
export async function deleteOrgRule(ruleId: number) {
    if (!supabase) throw new Error('Supabase is not configured');

    const { error, count } = await supabase
        .from('org_rules')
        .delete({ count: 'exact' })
        .eq('id', ruleId);

    if (error) {
        console.error('Error deleting org rule:', error);
        throw new Error(error.message || 'Failed to delete rule');
    }

    if (count === 0) {
        throw new Error('Rule not deleted (likely blocked by RLS or already removed)');
    }

    return true;
}

/**
 * Fetch audit event statistics for the organization
 */
export async function fetchAuditStats(orgId: string, daysBack: number = 7) {
    if (!supabase) return null;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('org_id', orgId)
        .gte('timestamp', startDate.toISOString());

    if (error) {
        console.error('Error fetching audit stats:', error);
        return null;
    }

    if (!data || data.length === 0) {
        return {
            totalDetections: 0,
            totalMasked: 0,
            totalBlocked: 0,
            detectionsByCategory: {},
            detectionsByMode: { shadow: 0, fix: 0, warn: 0 },
            trendByDay: []
        };
    }

    // Compute statistics
    let totalDetections = 0;
    let totalMasked = 0;
    let totalBlocked = 0;
    const detectionsByCategory: Record<string, number> = {};
    const detectionsByMode: Record<string, number> = { shadow: 0, fix: 0, warn: 0 };
    const trendByDay: Record<string, number> = {};

    for (const event of data) {
        totalDetections += event.detection_count || 0;
        if (event.action_taken === 'masked') totalMasked += 1;
        if (event.action_taken === 'blocked') totalBlocked += 1;

        // Category breakdown
        if (event.categories_found && Array.isArray(event.categories_found)) {
            for (const cat of event.categories_found) {
                detectionsByCategory[cat] = (detectionsByCategory[cat] || 0) + 1;
            }
        }

        // Mode breakdown
        if (event.mode && detectionsByMode.hasOwnProperty(event.mode)) {
            detectionsByMode[event.mode] += 1;
        }

        // Trend by day
        const day = new Date(event.timestamp).toISOString().split('T')[0];
        trendByDay[day] = (trendByDay[day] || 0) + (event.detection_count || 0);
    }

    return {
        totalDetections,
        totalMasked,
        totalBlocked,
        detectionsByCategory,
        detectionsByMode,
        trendByDay
    };
}
