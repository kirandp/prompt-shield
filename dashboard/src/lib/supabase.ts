/**
 * Supabase Client Initialization
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Subscribe to real-time audit events
 */
export function subscribeToAuditEvents(callback: (event: any) => void) {
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
