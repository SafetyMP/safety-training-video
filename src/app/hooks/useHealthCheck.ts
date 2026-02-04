'use client';

import { useState, useEffect } from 'react';

/**
 * Fetches /api/health and exposes whether OpenAI is configured.
 */
export function useHealthCheck(): boolean | null {
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setOpenaiConfigured(d.openaiConfigured ?? false))
      .catch(() => setOpenaiConfigured(false));
  }, []);

  return openaiConfigured;
}
