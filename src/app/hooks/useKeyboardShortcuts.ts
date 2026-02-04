'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutHandlers {
  onGenerate?: () => void;
  onCancel?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const { onGenerate, onCancel } = handlers;

  const isEditableTarget = (target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        onGenerate?.();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    },
    [onGenerate, onCancel]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
