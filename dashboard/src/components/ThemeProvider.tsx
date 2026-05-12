'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeName = 'classic' | 'futuristic';

interface ThemeContextValue {
    theme: ThemeName;
    setTheme: (t: ThemeName) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'promptshield-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Default to futuristic so first impression matches the new design.
    const [theme, setThemeState] = useState<ThemeName>('futuristic');
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const stored = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) as ThemeName | null;
        const initial: ThemeName = stored === 'classic' || stored === 'futuristic' ? stored : 'futuristic';
        setThemeState(initial);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            /* ignore storage failures */
        }
    }, [theme, hydrated]);

    const value: ThemeContextValue = {
        theme,
        setTheme: setThemeState,
        toggleTheme: () => setThemeState((t) => (t === 'futuristic' ? 'classic' : 'futuristic')),
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        // Allow non-provider usage with safe defaults during SSR / tests.
        return {
            theme: 'futuristic' as ThemeName,
            setTheme: () => undefined,
            toggleTheme: () => undefined,
        };
    }
    return ctx;
}
