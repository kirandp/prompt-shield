'use client';

import React from 'react';

interface ComplianceStatus {
    regulation: string;
    icon: string;
    status: 'active' | 'warning' | 'inactive';
    percentage: number;
    lastUpdated: string;
}

export function ComplianceLedger() {
    const [statuses] = React.useState<ComplianceStatus[]>([
        {
            regulation: 'HIPAA',
            icon: '🏥',
            status: 'active',
            percentage: 98,
            lastUpdated: '2 min ago',
        },
        {
            regulation: 'GDPR',
            icon: '🇪🇺',
            status: 'active',
            percentage: 95,
            lastUpdated: '5 min ago',
        },
        {
            regulation: 'PCI-DSS',
            icon: '💳',
            status: 'active',
            percentage: 92,
            lastUpdated: '10 min ago',
        },
    ]);

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'active':
                return 'status-active';
            case 'warning':
                return 'status-warning';
            default:
                return 'status-inactive';
        }
    };

    return (
        <div className="compliance-ledger" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)' }}>
                Compliance Status
            </h3>
            <div className="compliance-panel">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {statuses.map((item) => (
                        <div
                            key={item.regulation}
                            style={{
                                padding: '16px',
                                borderRadius: '8px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-background)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '12px',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '20px' }}>{item.icon}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                        {item.regulation}
                                    </span>
                                </div>
                                <div className={`status-badge ${getStatusClass(item.status)}`}>
                                    {item.status === 'active' ? '✓' : '!'}
                                    {item.status}
                                </div>
                            </div>

                            <div style={{ marginBottom: '8px' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '12px',
                                        marginBottom: '6px',
                                    }}
                                >
                                    <span style={{ color: 'var(--color-text-secondary)' }}>
                                        Compliance Score
                                    </span>
                                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                        {item.percentage}%
                                    </span>
                                </div>
                                <div
                                    style={{
                                        width: '100%',
                                        height: '6px',
                                        borderRadius: '3px',
                                        background: 'rgba(45, 212, 191, 0.1)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${item.percentage}%`,
                                            height: '100%',
                                            background: 'var(--color-primary)',
                                            borderRadius: '3px',
                                            transition: 'width 0.3s ease',
                                        }}
                                    />
                                </div>
                            </div>

                            <div
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--color-text-tertiary)',
                                }}
                            >
                                Last updated: {item.lastUpdated}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
