const { Presidio } = require('@microsoft/presidio');

// Initialize Presidio with custom patterns
const presidio = new Presidio({
    model: {
        entities: [
            { type: 'SSN', pattern: '\d{3}-\d{2}-\d{4}' },
            { type: 'NAME', pattern: '\b[A-Z][a-z]+\s[A-Z][a-z]+\b' },
            { type: 'EMAIL', pattern: '\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', exclude: true },
            { type: 'ICD-10', pattern: 'E\d{2}\.\d' }
        ]
    }
});

// Process input text
const inputText = "Patient: John Smith, SSN: 428-55-9021, ICD-10: E11.9";
const result = presidio.analyze(inputText);

// Output results
console.log("Detected PII:", result.entities);
console.log("Anonymized Text:", presidio.anonymize(inputText));