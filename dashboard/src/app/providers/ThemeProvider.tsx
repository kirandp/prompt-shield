'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'legacy' | 'neo';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('legacy');
    const [mounted, setMounted] = useState(false);

    // Load theme from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('promptshield-theme') as Theme | null;
        if (savedTheme && (savedTheme === 'legacy' || savedTheme === 'neo')) {
            setThemeState(savedTheme);
        }
        setMounted(true);
    }, []);

    // Apply theme to document
    useEffect(() => {
        if (!mounted) return;

        const html = document.documentElement;
        html.classList.remove('theme-legacy', 'theme-neo');
        html.classList.add(`theme-${theme}`);
        localStorage.setItem('promptshield-theme', theme);
    }, [theme, mounted]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const toggleTheme = () => {
        setTheme(theme === 'legacy' ? 'neo' : 'legacy');
    };

    // Avoid hydration mismatch
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
