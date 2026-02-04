'use client';

import { useState } from 'react';
import { Button } from '@/app/components/shared/Button';
import { HelpModal } from '@/app/components/shared/HelpModal';
import { useTheme, type Theme } from '@/app/contexts/ThemeContext';

export function Header() {
  const [helpOpen, setHelpOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  const displayTheme = theme === null ? 'system' : theme;
  const cycleTheme = () => {
    const next: Theme = displayTheme === 'light' ? 'dark' : displayTheme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return (
    <header className="flex items-center justify-between gap-4 py-4 border-b border-[var(--card-border)]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0" aria-hidden>
          ⛑️
        </span>
        <div>
          <h1 className="text-xl font-display font-semibold text-[var(--foreground)] truncate">
            Safety Training Video Creator
          </h1>
          <p className="text-xs text-[var(--muted)] hidden sm:block">
            Create professional training videos from plain language
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={cycleTheme}
          className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--card-border)] hover:text-[var(--foreground)] transition-colors"
          aria-label={`Theme: ${displayTheme}. Switch to ${
            displayTheme === 'light' ? 'dark' : displayTheme === 'dark' ? 'system' : 'light'
          }`}
          title="Toggle theme"
        >
          <span className="sr-only">
            Switch to {displayTheme === 'light' ? 'dark' : displayTheme === 'dark' ? 'system' : 'light'} theme
          </span>
          {resolvedTheme === 'dark' ? (
            <span className="text-lg" aria-hidden>🌙</span>
          ) : (
            <span className="text-lg" aria-hidden>☀️</span>
          )}
        </button>
        <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
          Help
        </Button>
      </div>

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
