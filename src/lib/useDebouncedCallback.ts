import { useRef, useCallback, useEffect } from 'react';

/**
 * Returns a debounced callback. The callback is invoked after `delayMs` of no calls.
 * Flush invokes immediately with the latest pending args.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delayMs: number
): { debounced: T; flush: () => void } {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingArgsRef.current) {
      callbackRef.current(...pendingArgsRef.current);
      pendingArgsRef.current = null;
    }
  }, []);

  const debounced = useCallback(
    ((...args: Parameters<T>) => {
      pendingArgsRef.current = args;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (pendingArgsRef.current) {
          callbackRef.current(...pendingArgsRef.current);
          pendingArgsRef.current = null;
        }
      }, delayMs);
    }) as T,
    [delayMs]
  );

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { debounced, flush };
}
