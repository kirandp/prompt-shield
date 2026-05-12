'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

type CardProps = HTMLMotionProps<'div'> & {
    children: ReactNode;
    interactive?: boolean;
    glow?: 'purple' | 'blue' | 'green' | 'amber' | 'red' | 'none';
    className?: string;
};

const GLOW_CLASSES: Record<NonNullable<CardProps['glow']>, string> = {
    purple: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.25)]',
    blue: 'hover:shadow-[0_0_30px_rgba(56,189,248,0.25)]',
    green: 'hover:shadow-[0_0_24px_rgba(34,197,94,0.25)]',
    amber: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.25)]',
    red: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]',
    none: '',
};

export function Card({
    children,
    interactive = true,
    glow = 'purple',
    className = '',
    ...rest
}: CardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            whileHover={interactive ? { y: -2 } : undefined}
            className={`card glow-border ${GLOW_CLASSES[glow]} ${className}`}
            {...rest}
        >
            {children}
        </motion.div>
    );
}
