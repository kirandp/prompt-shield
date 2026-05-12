'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    FileSearch,
    SlidersHorizontal,
    ScrollText,
    BarChart3,
    Settings,
    Moon,
    Sun,
    Sparkles,
    LucideIcon,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface NavItem {
    href: string;
    label: string;
    Icon: LucideIcon;
}

const NAV: NavItem[] = [
    { href: '/shield', label: 'Shield Demo', Icon: Shield },
    { href: '/scanner', label: 'File Scanner', Icon: FileSearch },
    { href: '/rules', label: 'Custom Rules', Icon: SlidersHorizontal },
    { href: '/audit', label: 'Audit Log', Icon: ScrollText },
    { href: '/dashboard', label: 'Analytics', Icon: BarChart3 },
    { href: '/settings', label: 'Settings', Icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();

    return (
        <nav className="sidebar flex flex-col">
            <Link href="/shield" className="sidebar-brand" aria-label="PromptShield AI home">
                <div className="sidebar-brand-banner">
                    <Image
                        src="/promptshield-logo.png"
                        alt="PromptShield AI"
                        width={1408}
                        height={768}
                        priority
                        className="sidebar-brand-banner-img"
                    />
                </div>
                <div className="sidebar-brand-sub">
                    <span className="sidebar-brand-dot" aria-hidden="true" />
                    AI Security · Live
                </div>
            </Link>

            <div className="sidebar-tag">Workspaces</div>

            <ul className="nav-menu">
                {NAV.map(({ href, label, Icon }) => {
                    const active = pathname === href || pathname?.startsWith(href + '/');
                    return (
                        <li key={href}>
                            <Link href={href} className={active ? 'active' : ''}>
                                <Icon size={16} className="nav-icon" />
                                <span>{label}</span>
                                {active && (
                                    <motion.span
                                        layoutId="nav-active-dot"
                                        className="ml-auto h-1.5 w-1.5 rounded-full"
                                        style={{
                                            background:
                                                theme === 'futuristic'
                                                    ? 'linear-gradient(135deg, #8B5CF6, #38BDF8)'
                                                    : '#ffffff',
                                            boxShadow:
                                                theme === 'futuristic'
                                                    ? '0 0 8px rgba(139,92,246,0.8)'
                                                    : 'none',
                                        }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>

            <div className="theme-toggle-wrap">
                <button
                    type="button"
                    className="theme-toggle"
                    onClick={toggleTheme}
                    aria-label={`Switch to ${theme === 'futuristic' ? 'classic' : 'futuristic'} theme`}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {theme === 'futuristic' ? (
                            <motion.span
                                key="moon"
                                initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                                transition={{ duration: 0.18 }}
                                className="inline-flex items-center gap-2"
                            >
                                <Sparkles size={14} />
                                <span>Futuristic</span>
                            </motion.span>
                        ) : (
                            <motion.span
                                key="sun"
                                initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                                transition={{ duration: 0.18 }}
                                className="inline-flex items-center gap-2"
                            >
                                <Sun size={14} />
                                <span>Classic</span>
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <span
                        className="ml-auto text-[10px] uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {theme === 'futuristic' ? (
                            <span className="inline-flex items-center gap-1">
                                <Sun size={11} />
                                Switch
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1">
                                <Moon size={11} />
                                Switch
                            </span>
                        )}
                    </span>
                </button>
            </div>
        </nav>
    );
}
