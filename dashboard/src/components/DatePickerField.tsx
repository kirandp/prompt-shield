'use client';

import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromISODate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatDisplay(iso: string): string {
  const d = fromISODate(iso);
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DatePickerField({ value, onChange, placeholder = 'Pick a date', ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selected = fromISODate(value);

  return (
    <div ref={wrapperRef} className="date-picker-field">
      <button
        type="button"
        className="date-picker-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="date-picker-icon" aria-hidden="true">📅</span>
        <span className={value ? 'date-picker-value' : 'date-picker-placeholder'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            className="date-picker-clear"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onChange('');
              }
            }}
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className="date-picker-popover" role="dialog">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(toISODate(d));
                setOpen(false);
              }
            }}
            showOutsideDays
          />
        </div>
      )}
    </div>
  );
}
