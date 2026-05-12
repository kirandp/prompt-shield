'use client';

import { useEffect } from 'react';

type Variant = 'primary' | 'success' | 'warning' | 'danger';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="cd-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <div className="cd-modal" role="dialog" aria-modal="true" aria-labelledby="cd-title">
        <div className={`cd-accent cd-accent-${variant}`} aria-hidden />
        <div className="cd-body">
          <h3 id="cd-title">{title}</h3>
          <div className="cd-message">{message}</div>
          <div className="cd-actions">
            <button className="cd-btn cd-btn-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button className={`cd-btn cd-btn-${variant}`} onClick={onConfirm} autoFocus>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cd-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 24px;
          animation: cd-fade 0.15s ease;
        }

        .cd-modal {
          background: white;
          width: 100%;
          max-width: 460px;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
          overflow: hidden;
          animation: cd-pop 0.15s ease;
        }

        .cd-accent {
          height: 4px;
          width: 100%;
        }

        .cd-accent-primary { background: linear-gradient(90deg, #4285f4, #1a73e8); }
        .cd-accent-success { background: linear-gradient(90deg, #34a853, #0f6e56); }
        .cd-accent-warning { background: linear-gradient(90deg, #fbbc04, #f57c00); }
        .cd-accent-danger  { background: linear-gradient(90deg, #ea4335, #c5221f); }

        .cd-body {
          padding: 24px 24px 20px;
        }

        .cd-body h3 {
          margin: 0 0 10px;
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
        }

        .cd-message {
          font-size: 14px;
          color: #475569;
          line-height: 1.55;
          margin-bottom: 20px;
        }

        .cd-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .cd-btn {
          padding: 9px 18px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform 0.05s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .cd-btn:active {
          transform: scale(0.98);
        }

        .cd-btn-cancel {
          background: #fff;
          color: #475569;
          border-color: #e2e8f0;
        }

        .cd-btn-cancel:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .cd-btn-primary { background: #1a73e8; color: white; }
        .cd-btn-primary:hover { background: #1666c7; }

        .cd-btn-success { background: #0f6e56; color: white; }
        .cd-btn-success:hover { background: #0c5944; }

        .cd-btn-warning { background: #f57c00; color: white; }
        .cd-btn-warning:hover { background: #d96900; }

        .cd-btn-danger { background: #ea4335; color: white; }
        .cd-btn-danger:hover { background: #c5221f; }

        @keyframes cd-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes cd-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
