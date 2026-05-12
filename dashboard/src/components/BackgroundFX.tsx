'use client';

import { motion } from 'framer-motion';
import { useTheme } from './ThemeProvider';

export function BackgroundFX() {
    const { theme } = useTheme();

    if (theme !== 'futuristic') return null;

    return (
        <div className="bg-fx" aria-hidden="true">
            {/* Soft animated orbs */}
            <motion.div
                className="absolute h-[40rem] w-[40rem] rounded-full"
                style={{
                    top: '-10rem',
                    left: '-10rem',
                    background: 'radial-gradient(closest-side, rgba(139,92,246,0.25), transparent 70%)',
                    filter: 'blur(40px)',
                }}
                animate={{
                    x: [0, 40, -20, 0],
                    y: [0, 30, 10, 0],
                }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute h-[36rem] w-[36rem] rounded-full"
                style={{
                    bottom: '-10rem',
                    right: '-10rem',
                    background: 'radial-gradient(closest-side, rgba(56,189,248,0.18), transparent 70%)',
                    filter: 'blur(40px)',
                }}
                animate={{
                    x: [0, -40, 20, 0],
                    y: [0, -20, 10, 0],
                }}
                transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
            />
        </div>
    );
}
