'use client';

import React, { useState, useEffect } from 'react';

interface DataStep {
    label: string;
    content: string;
    type: 'raw' | 'detected' | 'redacted';
}

export function SanitizationFlow() {
    const [steps, setSteps] = useState<DataStep[]>([
        {
            label: 'Raw Input',
            content: 'Name: John Smith, SSN: 123-45-6789',
            type: 'raw',
        },
        {
            label: 'Detection',
            content: 'Detected: PERSON_NAME, SSN patterns',
            type: 'detected',
        },
        {
            label: 'Sanitized',
            content: 'Name: [PERSON_1], SSN: [SSN_1]',
            type: 'redacted',
        },
        {
            label: 'Safe Output',
            content: 'Ready for AI processing ✓',
            type: 'redacted',
        },
    ]);

    return (
        <div className="sanitization-flow-container" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)' }}>
                Sanitization Flow
            </h3>
            <div className="sanitization-flow">
                {steps.map((step, index) => (
                    <React.Fragment key={index}>
                        <div className="flow-step">
                            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>
                                {step.label}
                            </div>
                            <div
                                style={{
                                    fontSize: '12px',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    background: step.type === 'raw' ? 'rgba(239, 68, 68, 0.1)' :
                                        step.type === 'detected' ? 'rgba(245, 158, 11, 0.1)' :
                                            'rgba(16, 185, 129, 0.1)',
                                    color: step.type === 'raw' ? '#f87171' :
                                        step.type === 'detected' ? '#fbbf24' :
                                            '#6ee7b7',
                                }}
                            >
                                {step.content}
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="flow-arrow">→</div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
