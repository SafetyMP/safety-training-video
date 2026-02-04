'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['⌘', 'Enter'], action: 'Generate script (idle) or Create video (script step)' },
  { keys: ['Esc'], action: 'Cancel generation or regeneration' },
];

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = () => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        dialogRef.current?.focus();
      }
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md rounded-card border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const focusables = getFocusableElements();
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        ref={dialogRef}
        tabIndex={-1}
      >
        <h2
          id="help-modal-title"
          className="text-lg font-display font-semibold text-[var(--foreground)] mb-4"
        >
          Keyboard shortcuts
        </h2>
        <ul className="space-y-3 mb-6">
          {shortcuts.map(({ keys, action }) => (
            <li key={keys.join('-')} className="flex items-start gap-3 text-sm">
              <span className="flex shrink-0 gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-1 text-xs font-medium bg-[var(--card-border)] dark:bg-slate-600 rounded border border-[var(--card-border)] dark:border-slate-500"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="text-[var(--muted)]">{action}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
