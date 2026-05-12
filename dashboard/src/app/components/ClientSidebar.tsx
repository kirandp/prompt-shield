'use client';

import { useState, useEffect } from 'react';
import { ThemeSwitcher } from '../providers/ThemeSwitcher';

export function ClientSidebar() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <nav className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">🛡️</div>
                    <h1>PromptShield</h1>
                </div>
                <ul className="nav-menu">
                    <li><a href="/shield">Shield Demo</a></li>
                    <li><a href="/scanner">File Scanner</a></li>
                    <li><a href="/rules">Custom Rules</a></li>
                    <li><a href="/audit">Audit Log</a></li>
                    <li><a href="/dashboard">Analytics</a></li>
                    <li><a href="/settings">Settings</a></li>
                </ul>
            </nav>
        );
    }

    return (
        <nav className="sidebar">
            <div className="sidebar-header">
                <div className="logo">🛡️</div>
                <h1>PromptShield</h1>
            </div>

            <ul className="nav-menu">
                <li><a href="/shield">Shield Demo</a></li>
                <li><a href="/scanner">File Scanner</a></li>
                <li><a href="/rules">Custom Rules</a></li>
                <li><a href="/audit">Audit Log</a></li>
                <li><a href="/dashboard">Analytics</a></li>
                <li><a href="/settings">Settings</a></li>
            </ul>

            <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--color-border)' }}>
                <ThemeSwitcher />
            </div>
        </nav>
    );
}
