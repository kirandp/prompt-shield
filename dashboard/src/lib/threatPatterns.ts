/**
 * Threat detection patterns for the file upload scanner.
 *
 * Each pattern represents a known prompt-injection / jailbreak / policy-bypass
 * technique. Confidence is a calibrated 0..1 score reflecting how
 * unambiguously this phrase signals an attack vs. benign usage.
 */

export type ThreatCategory =
    | 'Prompt Injection'
    | 'Jailbreak'
    | 'System Prompt Leak'
    | 'Role Manipulation'
    | 'Data Exfiltration'
    | 'Policy Bypass';

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ThreatPattern = {
    id: string;
    category: ThreatCategory;
    pattern: RegExp;
    label: string;
    confidence: number;
    severity: ThreatSeverity;
};

export const THREAT_PATTERNS: ThreatPattern[] = [
    // Prompt Injection
    {
        id: 'PI_IGNORE_PREVIOUS',
        category: 'Prompt Injection',
        pattern: /ignore\s+(?:all\s+|the\s+|your\s+|any\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?|directions?)/gi,
        label: 'Ignore previous instructions',
        confidence: 0.97,
        severity: 'high',
    },
    {
        id: 'PI_DISREGARD',
        category: 'Prompt Injection',
        pattern: /(?:disregard|forget|override)\s+(?:all\s+|the\s+|your\s+|any\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules?)/gi,
        label: 'Disregard/forget instructions',
        confidence: 0.95,
        severity: 'high',
    },
    {
        id: 'PI_NEW_INSTRUCTIONS',
        category: 'Prompt Injection',
        pattern: /(?:new|updated|revised)\s+instructions?\s*[:\-]/gi,
        label: 'New instructions injection',
        confidence: 0.78,
        severity: 'medium',
    },
    {
        id: 'PI_ATTENTION',
        category: 'Prompt Injection',
        pattern: /\b(?:attention|important|critical)\s*(?:llm|ai|assistant|gpt|claude|model)\s*[:\-,]/gi,
        label: 'Direct LLM addressing',
        confidence: 0.82,
        severity: 'medium',
    },

    // System Prompt Leak
    {
        id: 'SPL_REVEAL_PROMPT',
        category: 'System Prompt Leak',
        pattern: /(?:reveal|show|print|display|reproduce|output|tell\s+me)\s+(?:your\s+|the\s+)?(?:system\s+prompt|initial\s+prompt|original\s+instructions?|hidden\s+(?:prompt|instructions?))/gi,
        label: 'Reveal system prompt',
        confidence: 0.96,
        severity: 'high',
    },
    {
        id: 'SPL_REPEAT_ABOVE',
        category: 'System Prompt Leak',
        pattern: /repeat\s+(?:the\s+|everything\s+|all\s+text\s+)?above/gi,
        label: 'Repeat above context',
        confidence: 0.74,
        severity: 'medium',
    },
    {
        id: 'SPL_WHAT_INSTRUCTIONS',
        category: 'System Prompt Leak',
        pattern: /what\s+(?:are\s+|were\s+)?your\s+(?:original\s+|initial\s+|system\s+)?(?:instructions?|prompts?|rules?)/gi,
        label: 'Probe for instructions',
        confidence: 0.85,
        severity: 'medium',
    },

    // Jailbreak
    {
        id: 'JB_DAN',
        category: 'Jailbreak',
        pattern: /\b(?:DAN|do\s+anything\s+now)\b/gi,
        label: 'DAN (Do Anything Now)',
        confidence: 0.94,
        severity: 'critical',
    },
    {
        id: 'JB_DEV_MODE',
        category: 'Jailbreak',
        pattern: /(?:developer|dev|debug|admin|god|sudo|root)\s+mode\s+(?:enabled|on|activated|active)/gi,
        label: 'Developer mode activation',
        confidence: 0.93,
        severity: 'high',
    },
    {
        id: 'JB_DISABLE_SAFETY',
        category: 'Jailbreak',
        pattern: /(?:disable|turn\s+off|bypass|remove|ignore)\s+(?:your\s+|the\s+|all\s+)?(?:safety|content|moderation|ethical?|guard)\s*(?:filters?|guidelines?|policies|rails?|measures?)?/gi,
        label: 'Disable safety guardrails',
        confidence: 0.95,
        severity: 'critical',
    },
    {
        id: 'JB_NO_RESTRICTIONS',
        category: 'Jailbreak',
        pattern: /(?:without|no|free\s+from|free\s+of)\s+(?:any\s+)?(?:restrictions?|filters?|limits?|rules?|censorship)/gi,
        label: 'Operate without restrictions',
        confidence: 0.86,
        severity: 'high',
    },
    {
        id: 'JB_HYPOTHETICAL',
        category: 'Jailbreak',
        pattern: /(?:hypothetically|imagine|pretend|let'?s\s+say)\s+(?:you\s+)?(?:are|have\s+no|had\s+no|could)\s+(?:no|zero|removed)\s+(?:rules?|restrictions?|filters?)/gi,
        label: 'Hypothetical jailbreak framing',
        confidence: 0.82,
        severity: 'high',
    },

    // Role Manipulation
    {
        id: 'RM_YOU_ARE_NOW',
        category: 'Role Manipulation',
        pattern: /you\s+are\s+(?:now\s+)?(?:a\s+|an\s+)?(?:hacker|criminal|villain|evil|unrestricted|unfiltered|jailbroken|uncensored)/gi,
        label: 'Role reassignment',
        confidence: 0.91,
        severity: 'high',
    },
    {
        id: 'RM_ACT_AS',
        category: 'Role Manipulation',
        pattern: /(?:act|behave|respond|pretend\s+to\s+be)\s+as\s+(?:a\s+|an\s+|if\s+you\s+(?:were|are)\s+(?:a\s+|an\s+)?)?(?:hacker|criminal|unrestricted\s+ai|unfiltered\s+ai|jailbroken)/gi,
        label: 'Act-as adversarial role',
        confidence: 0.9,
        severity: 'high',
    },
    {
        id: 'RM_NEW_PERSONA',
        category: 'Role Manipulation',
        pattern: /your\s+new\s+(?:name|persona|identity|role)\s+is/gi,
        label: 'New persona assignment',
        confidence: 0.83,
        severity: 'medium',
    },

    // Data Exfiltration
    {
        id: 'DE_API_KEY',
        category: 'Data Exfiltration',
        pattern: /(?:send|email|post|exfiltrate|upload|forward)\s+(?:all\s+|the\s+|your\s+)?(?:api\s+keys?|tokens?|credentials?|passwords?|secrets?)\s+to/gi,
        label: 'Exfiltrate credentials',
        confidence: 0.96,
        severity: 'critical',
    },
    {
        id: 'DE_EXTERNAL_URL',
        category: 'Data Exfiltration',
        pattern: /(?:fetch|curl|wget|http\.get|requests\.get)\s*\(?\s*["']https?:\/\/(?!localhost|127\.0\.0\.1)/gi,
        label: 'External fetch from prompt',
        confidence: 0.7,
        severity: 'medium',
    },
    {
        id: 'DE_BASE64',
        category: 'Data Exfiltration',
        pattern: /(?:encode|wrap|embed)\s+(?:in|as|using)\s+base64\s+and\s+(?:send|post|fetch|exfiltrate)/gi,
        label: 'Base64 exfiltration',
        confidence: 0.88,
        severity: 'high',
    },

    // Policy Bypass
    {
        id: 'PB_FOR_EDUCATIONAL',
        category: 'Policy Bypass',
        pattern: /(?:for\s+(?:educational|research|academic)\s+purposes\s+only)\s*[,\.]?\s*(?:explain|describe|tell|provide|generate|write)\s+(?:how\s+to|the\s+steps?\s+to)/gi,
        label: 'Educational-purpose bypass',
        confidence: 0.72,
        severity: 'medium',
    },
    {
        id: 'PB_FICTIONAL_FRAME',
        category: 'Policy Bypass',
        pattern: /(?:in\s+a\s+(?:fictional|hypothetical)\s+(?:story|scenario|world))\s+(?:where|in\s+which)\s+.*?(?:explain|describe|provide)/gi,
        label: 'Fictional-framing bypass',
        confidence: 0.68,
        severity: 'low',
    },
    {
        id: 'PB_OVERRIDE_POLICY',
        category: 'Policy Bypass',
        pattern: /(?:override|bypass|circumvent|ignore)\s+(?:your\s+|the\s+|all\s+)?(?:content\s+policy|usage\s+policy|terms?\s+of\s+service|guidelines?|safety\s+policy)/gi,
        label: 'Explicit policy override',
        confidence: 0.93,
        severity: 'critical',
    },
];

export const SEVERITY_WEIGHT: Record<ThreatSeverity, number> = {
    low: 10,
    medium: 25,
    high: 50,
    critical: 80,
};
