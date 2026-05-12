'use client';

import { useTheme } from './ThemeProvider';
import { Suspense } from 'react';

function ThemeSwitcherContent() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'legacy' ? 'Neo-Cyber' : 'Legacy'} theme`}
            aria-label="Toggle theme"
        >
            {theme === 'legacy' ? (
                <>
                    <span>🌙</span>
                    <span>Neo-Cyber</span>
                </>
            ) : (
                <>
                    <span>☀️</span>
                    <span>Legacy</span>
                </>
            )}
        </button>
    );
}

export function ThemeSwitcher() {
    return (
        <Suspense fallback={<div style={{ height: '36px' }} />}>
            <ThemeSwitcherContent />
        </Suspense>
    );
}
