/**
 * Detection and Audit Types
 */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type DataCategory = 'PHI' | 'PII' | 'SECRET' | 'FINANCIAL' | 'CUSTOM';
export type DetectionType = 'regex' | 'rule' | 'ai';
export type ProtectionMode = 'shadow' | 'fix' | 'warn';

export interface Detection {
    id: string;
    text: string;
    start: number;
    end: number;
    patternId: string;
    category: DataCategory;
    severity: SeverityLevel;
    type: DetectionType;
    isAI?: boolean;
}

export interface AuditEvent {
    id: number;
    org_id: string;
    user_id: string;
    session_id: string;
    event_type: string;
    mode: ProtectionMode;
    detection_count: number;
    categories_found: DataCategory[];
    max_severity: SeverityLevel;
    ai_tool?: string;
    action_taken: string;
    context_metadata?: Record<string, any>;
    timestamp: string;
}

export interface Rule {
    id: string | number;
    name: string;
    type: 'exact' | 'regex' | 'category' | 'keyword';
    pattern?: string;
    match?: string;
    replacement: string;
    category?: DataCategory;
    scope: 'session' | 'always';
    caseSensitive?: boolean;
    enabled: boolean;
    isOrgRule: boolean;
    hits: number;
    createdAt: string;
}

export interface DetectionStats {
    total: number;
    bySeverity: Record<SeverityLevel, number>;
    byCategory: Record<DataCategory, number>;
    byType: Record<DetectionType, number>;
}
