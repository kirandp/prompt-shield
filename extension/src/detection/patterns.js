/**
 * PromptShield Detection Patterns
 * All regex patterns for PII, PHI, Secrets, and Financial data detection
 */

// ============================================================================
// PHI (Protected Health Information - HIPAA)
// ============================================================================

export const PHI_PATTERNS = {
    // Social Security Number: 123-45-6789 or XXX-XX-9021 (masked)
    SSN: {
        id: 'SSN',
        pattern: /\b(?:\d{3}|XXX)-(?:\d{2}|XX)-(?:\d{4}|\d{4})\b/g,
        category: 'PHI',
        severity: 'critical',
        description: 'Social Security Number'
    },

    // Medical Record Number: MRN: 123456 or MRN****** or Medical Record Number:
    MRN: {
        id: 'MRN',
        pattern: /(?:MRN|Medical\s+Record\s+Number)[:\s]+([0-9A-Z\-*]{4,30})/gi,
        category: 'PHI',
        severity: 'critical',
        description: 'Medical Record Number'
    },

    // Health Insurance ID: various formats
    INSURANCE_ID: {
        id: 'INSURANCE_ID',
        pattern: /(?:Insurance\s+ID|Policy\s+Number|Member\s+ID)[:\s]+([0-9A-Z\-]{5,30})/gi,
        category: 'PHI',
        severity: 'high',
        description: 'Health Insurance ID'
    },

    // ICD-10 diagnosis codes: E11.9, I10, M79.3
    ICD10_CODE: {
        id: 'ICD10_CODE',
        pattern: /\b[A-Z]\d{2}(?:\.\d{1,2})?\b/g,
        category: 'PHI',
        severity: 'medium',
        description: 'ICD-10 Diagnosis Code'
    },

    // Medication names (common pattern)
    MEDICATION: {
        id: 'MEDICATION',
        pattern: /\b(?:aspirin|ibuprofen|metformin|lisinopril|atorvastatin|omeprazole|albuterol|levothyroxine|amoxicillin|sertraline|metoprolol|amlodipine|simvastatin|fluoxetine|clopidogrel)\b/gi,
        category: 'PHI',
        severity: 'medium',
        description: 'Medication Name'
    },

    // Patient age >89 with context
    PATIENT_AGE: {
        id: 'PATIENT_AGE',
        pattern: /(?:patient\s+age|age\s+of|aged?)[:\s]+([89]\d|1\d{2})/gi,
        category: 'PHI',
        severity: 'medium',
        description: 'Patient Age (>89)'
    },

    // NPI (National Provider Identifier): 10 digit number
    NPI: {
        id: 'NPI',
        pattern: /(?:NPI|Provider\s+ID)[:\s]*([0-9]{10})\b/gi,
        category: 'PHI',
        severity: 'high',
        description: 'National Provider Identifier'
    },

    // Treatment date with context: "Treatment Date: 2024-01-15" or similar
    TREATMENT_DATE: {
        id: 'TREATMENT_DATE',
        pattern: /(?:treatment\s+date|admission\s+date|discharge\s+date|visit\s+date|procedure\s+date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/gi,
        category: 'PHI',
        severity: 'high',
        description: 'Treatment Date'
    }
};

// ============================================================================
// PII (Personally Identifiable Information - GDPR)
// ============================================================================

export const PII_PATTERNS = {
    // Patient/Person name with context: "Patient: John Smith" or "Name: Jane Doe"
    PATIENT_NAME: {
        id: 'PATIENT_NAME',
        pattern: /(?:patient|name|called|named)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
        category: 'PII',
        severity: 'high',
        description: 'Patient/Person Name'
    },

    // Email address
    EMAIL: {
        id: 'EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        category: 'PII',
        severity: 'high',
        description: 'Email Address'
    },

    // US Phone number: (123) 456-7890 or 123-456-7890 or 1234567890
    US_PHONE: {
        id: 'US_PHONE',
        pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        category: 'PII',
        severity: 'high',
        description: 'Phone Number (US)'
    },

    // International phone: +44 20 7946 0958, +1-541-754-3010, +33 1 42 68 53 00
    INTL_PHONE: {
        id: 'INTL_PHONE',
        pattern: /\+(?:1|7|20|27|30|31|32|33|34|36|39|40|41|43|44|45|46|47|48|49|51|52|53|54|55|56|57|58|60|61|62|63|64|65|66|81|82|84|86|90|91|92|93|94|98)\s?(?:\(?\d{1,4}\)?[-\s]?)*\d{1,4}[-\s]?\d{1,9}/g,
        category: 'PII',
        severity: 'high',
        description: 'Phone Number (International)'
    },

    // Credit Card Number (with Luhn validation check in code)
    CREDIT_CARD: {
        id: 'CREDIT_CARD',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        category: 'PII',
        severity: 'critical',
        description: 'Credit Card Number'
    },

    // CVV (3-4 digits)
    CVV: {
        id: 'CVV',
        pattern: /(?:CVV|CVC|CID)[:\s]*\b\d{3,4}\b/gi,
        category: 'PII',
        severity: 'critical',
        description: 'Card Verification Value (CVV)'
    },

    // Bank Account Number
    BANK_ACCOUNT: {
        id: 'BANK_ACCOUNT',
        pattern: /(?:account\s+number|account\s+no|acct)[:\s]*([0-9]{8,17})/gi,
        category: 'PII',
        severity: 'critical',
        description: 'Bank Account Number'
    },

    // Routing Number (9 digits)
    ROUTING_NUMBER: {
        id: 'ROUTING_NUMBER',
        pattern: /(?:routing\s+number|routing\s+code|ABA)[:\s]*\b\d{9}\b/gi,
        category: 'PII',
        severity: 'critical',
        description: 'Bank Routing Number'
    },

    // Passport Number
    PASSPORT: {
        id: 'PASSPORT',
        pattern: /(?:passport\s+number|passport)[:\s]*([A-Z0-9]{6,9})/gi,
        category: 'PII',
        severity: 'high',
        description: 'Passport Number'
    },

    // Driver's License
    DRIVERS_LICENSE: {
        id: 'DRIVERS_LICENSE',
        pattern: /(?:driver.?s?\s+license|DL)[:\s]*([A-Z0-9]{5,8})/gi,
        category: 'PII',
        severity: 'high',
        description: "Driver's License"
    },

    // Employee ID
    EMPLOYEE_ID: {
        id: 'EMPLOYEE_ID',
        pattern: /(?:employee\s+id|emp\s+id|employee\s+no)[:\s]*([A-Z0-9]{4,8})/gi,
        category: 'PII',
        severity: 'high',
        description: 'Employee ID'
    },

    // US Street Address: Basic pattern
    STREET_ADDRESS: {
        id: 'STREET_ADDRESS',
        pattern: /\b\d{1,5}\s+(?:North|South|East|West|N|S|E|W)?\s*[A-Z][A-Za-z\s]+(?:Street|Street|Ave|Avenue|Boulevard|Blvd|Road|Rd|Way|Drive|Dr|Circle|Ct|Court|Lane|Ln)\b/gi,
        category: 'PII',
        severity: 'medium',
        description: 'Street Address'
    },

    // Date of Birth: mm/dd/yyyy, mm-dd-yyyy, dd/mm/yyyy
    DATE_OF_BIRTH: {
        id: 'DATE_OF_BIRTH',
        pattern: /(?:dob|date\s+of\s+birth|birth\s+date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        category: 'PII',
        severity: 'high',
        description: 'Date of Birth'
    },

    // IBAN (International Bank Account Number)
    IBAN: {
        id: 'IBAN',
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g,
        category: 'PII',
        severity: 'critical',
        description: 'IBAN'
    }
};

// ============================================================================
// SECRETS (API Keys, Tokens, Credentials)
// ============================================================================

export const SECRET_PATTERNS = {
    // Anthropic API Key: sk-ant-...
    ANTHROPIC_KEY: {
        id: 'ANTHROPIC_KEY',
        pattern: /sk-ant-[a-zA-Z0-9]{20,}\b/g,
        category: 'SECRET',
        severity: 'critical',
        description: 'Anthropic API Key'
    },

    // OpenAI API Key: sk-...
    OPENAI_KEY: {
        id: 'OPENAI_KEY',
        pattern: /sk-[a-zA-Z0-9]{20,}\b/g,
        category: 'SECRET',
        severity: 'critical',
        description: 'OpenAI API Key'
    },

    // GitHub Token: ghp_...
    GITHUB_TOKEN: {
        id: 'GITHUB_TOKEN',
        pattern: /ghp_[a-zA-Z0-9]{36,}\b/g,
        category: 'SECRET',
        severity: 'critical',
        description: 'GitHub Personal Access Token'
    },

    // AWS Access Key: AKIA...
    AWS_ACCESS_KEY: {
        id: 'AWS_ACCESS_KEY',
        pattern: /AKIA[0-9A-Z]{16}\b/g,
        category: 'SECRET',
        severity: 'critical',
        description: 'AWS Access Key ID'
    },

    // AWS Secret Key (follows AKIA key)
    AWS_SECRET_KEY: {
        id: 'AWS_SECRET_KEY',
        pattern: /aws_secret_access_key[:\s]*([A-Za-z0-9\/+=]{40})/gi,
        category: 'SECRET',
        severity: 'critical',
        description: 'AWS Secret Access Key'
    },

    // Database connection string: postgresql://, mysql://, mongodb://
    DB_CONNECTION: {
        id: 'DB_CONNECTION',
        pattern: /(?:postgresql|postgres|mysql|mongodb|mongodb\+srv|sqlserver):[\/\/]*(?:[^:]+:[^@]+@)?[^\s]+/gi,
        category: 'SECRET',
        severity: 'critical',
        description: 'Database Connection String'
    },

    // Private Key (PEM format)
    PRIVATE_KEY: {
        id: 'PRIVATE_KEY',
        pattern: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |DSA |EC )?PRIVATE KEY-----/g,
        category: 'SECRET',
        severity: 'critical',
        description: 'Private Key (PEM)'
    },

    // JWT Token (three parts separated by dots)
    JWT_TOKEN: {
        id: 'JWT_TOKEN',
        pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[\w\-]+/g,
        category: 'SECRET',
        severity: 'high',
        description: 'JWT Token'
    },

    // .env style secrets: KEY=value
    ENV_VAR: {
        id: 'ENV_VAR',
        pattern: /(?:API_KEY|SECRET|PASSWORD|TOKEN|KEY)[:\s]*([A-Za-z0-9_\-\.\/$%&+=]{10,})/gi,
        category: 'SECRET',
        severity: 'high',
        description: 'Environment Variable Secret'
    },

    // Internal IP addresses (RFC 1918)
    INTERNAL_IP: {
        id: 'INTERNAL_IP',
        pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
        category: 'SECRET',
        severity: 'medium',
        description: 'Internal IP Address (RFC 1918)'
    },

    // Slack API Token
    SLACK_TOKEN: {
        id: 'SLACK_TOKEN',
        pattern: /xo(?:b|xp)-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9_]{24,}/g,
        category: 'SECRET',
        severity: 'critical',
        description: 'Slack API Token'
    },

    // Google API Key
    GOOGLE_API_KEY: {
        id: 'GOOGLE_API_KEY',
        pattern: /AIza[0-9A-Za-z\-_]{35}/g,
        category: 'SECRET',
        severity: 'critical',
        description: 'Google API Key'
    }
};

// ============================================================================
// FINANCIAL DATA (PCI-DSS)
// ============================================================================

export const FINANCIAL_PATTERNS = {
    // SWIFT/BIC Code
    SWIFT_CODE: {
        id: 'SWIFT_CODE',
        pattern: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,
        category: 'FINANCIAL',
        severity: 'high',
        description: 'SWIFT/BIC Code'
    },

    // Credit Card Expiry Date
    CARD_EXPIRY: {
        id: 'CARD_EXPIRY',
        pattern: /(?:expir|exp)[:\s]*([0-9]{1,2}[\/\-][0-9]{2,4})/gi,
        category: 'FINANCIAL',
        severity: 'high',
        description: 'Card Expiry Date'
    },

    // Transaction ID
    TRANSACTION_ID: {
        id: 'TRANSACTION_ID',
        pattern: /(?:transaction\s+id|txn\s+id|trans\s+id)[:\s]*([A-Z0-9]{8,20})/gi,
        category: 'FINANCIAL',
        severity: 'medium',
        description: 'Transaction ID'
    },

    // Salary/Financial Amount with context
    SALARY: {
        id: 'SALARY',
        pattern: /(?:salary|income|wage|compensation)[:\s]*(?:\$|€|£)?[\d,]+(?:\.\d{2})?/gi,
        category: 'FINANCIAL',
        severity: 'medium',
        description: 'Salary/Financial Amount'
    }
};

// ============================================================================
// Combined Pattern List for Easy Iteration
// ============================================================================

export const ALL_PATTERNS = {
    ...PHI_PATTERNS,
    ...PII_PATTERNS,
    ...SECRET_PATTERNS,
    ...FINANCIAL_PATTERNS
};

/**
 * Get all pattern objects as an array
 */
export function getAllPatternObjects() {
    return Object.values(ALL_PATTERNS);
}

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category) {
    return Object.values(ALL_PATTERNS).filter(p => p.category === category);
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity) {
    return Object.values(ALL_PATTERNS).filter(p => p.severity === severity);
}
