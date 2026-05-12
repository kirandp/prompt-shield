'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    className?: string;
}

export function AnimatedCounter({ value, duration = 1.2, className }: AnimatedCounterProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: false, margin: '-10% 0px' });
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (!inView) return;
        const controls = animate(0, value, {
            duration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate(latest) {
                setDisplay(Math.round(latest));
            },
        });
        return () => controls.stop();
    }, [value, duration, inView]);

    return (
        <span ref={ref} className={className}>
            {display.toLocaleString()}
        </span>
    );
}
