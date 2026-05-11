import {
    THREAT_PATTERNS,
    SEVERITY_WEIGHT,
    ThreatCategory,
    ThreatSeverity,
    ThreatPattern,
} from './threatPatterns';

export type ThreatFinding = {
    id: string;
    pattern: string;
    label: string;
    category: ThreatCategory;
    confidence: number;
    severity: ThreatSeverity;
    matches: string[];
    excerpt: string;
};

export type ScanResult = {
    status: 'success';
    file_name: string;
    file_type: string;
    risk_score: number;
    severity: 'safe' | ThreatSeverity;
    safe: boolean;
    threats_detected: ThreatFinding[];
    categories_found: ThreatCategory[];
    extracted_chars: number;
    scan_time_ms: number;
    // Populated by the API so the client can forward the extracted text to
    // the LLM after a clean scan, without re-uploading the file.
    extracted_text?: string;
};

const EXCERPT_RADIUS = 40;

function buildExcerpt(text: string, match: RegExpMatchArray): string {
    const start = Math.max(0, (match.index ?? 0) - EXCERPT_RADIUS);
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + EXCERPT_RADIUS);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    return prefix + text.slice(start, end).replace(/\s+/g, ' ').trim() + suffix;
}

function findMatches(text: string, p: ThreatPattern): ThreatFinding | null {
    // Always reset lastIndex; the patterns are declared with /g.
    p.pattern.lastIndex = 0;
    const matches: string[] = [];
    let firstMatch: RegExpMatchArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = p.pattern.exec(text)) !== null) {
        if (!firstMatch) firstMatch = m;
        matches.push(m[0]);
        // Guard against zero-width matches getting stuck in a loop.
        if (m.index === p.pattern.lastIndex) p.pattern.lastIndex++;
        if (matches.length >= 5) break;
    }
    if (!firstMatch) return null;
    return {
        id: p.id,
        pattern: p.pattern.source,
        label: p.label,
        category: p.category,
        confidence: p.confidence,
        severity: p.severity,
        matches,
        excerpt: buildExcerpt(text, firstMatch),
    };
}

function computeRiskScore(threats: ThreatFinding[]): number {
    if (threats.length === 0) return 0;
    let score = 0;
    for (const t of threats) {
        // Weighted by severity * confidence, with diminishing returns past 3
        // matches of the same pattern so a single repeated phrase can't dominate.
        const matchBoost = 1 + Math.min(t.matches.length - 1, 2) * 0.25;
        score += SEVERITY_WEIGHT[t.severity] * t.confidence * matchBoost;
    }
    // Distinct-category bonus: an attack chaining 3+ categories is more
    // dangerous than 3 hits in one category.
    const distinctCats = new Set(threats.map((t) => t.category)).size;
    if (distinctCats >= 3) score *= 1.2;
    return Math.min(100, Math.round(score));
}

function deriveSeverity(score: number, threats: ThreatFinding[]): 'safe' | ThreatSeverity {
    if (threats.length === 0) return 'safe';
    if (threats.some((t) => t.severity === 'critical') || score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
}

export function analyzeText(
    text: string,
    meta: { file_name: string; file_type: string },
): ScanResult {
    const t0 = Date.now();
    const threats: ThreatFinding[] = [];
    for (const p of THREAT_PATTERNS) {
        const finding = findMatches(text, p);
        if (finding) threats.push(finding);
    }
    threats.sort((a, b) => {
        const sevDelta = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
        if (sevDelta !== 0) return sevDelta;
        return b.confidence - a.confidence;
    });

    const risk_score = computeRiskScore(threats);
    const severity = deriveSeverity(risk_score, threats);
    const categories_found = Array.from(new Set(threats.map((t) => t.category)));

    return {
        status: 'success',
        file_name: meta.file_name,
        file_type: meta.file_type,
        risk_score,
        severity,
        safe: severity === 'safe',
        threats_detected: threats,
        categories_found,
        extracted_chars: text.length,
        scan_time_ms: Date.now() - t0,
    };
}
