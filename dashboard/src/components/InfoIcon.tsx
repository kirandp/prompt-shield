'use client';

import { ReactNode } from 'react';

type Props = {
  label: string;
  children: ReactNode;
  align?: 'left' | 'right';
};

export function InfoIcon({ label, children, align = 'left' }: Props) {
  return (
    <span className="info-icon-wrapper">
      <button
        type="button"
        className="info-icon"
        aria-label={label}
        tabIndex={0}
      >
        i
      </button>
      <span className={`info-tooltip info-tooltip-${align}`} role="tooltip">
        {children}
      </span>
    </span>
  );
}
