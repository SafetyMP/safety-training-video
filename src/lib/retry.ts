const DEFAULT_ATTEMPTS = 3;
const INITIAL_MS = 1000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; initialMs?: number } = {}
): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const initialMs = options.initialMs ?? INITIAL_MS;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) throw err;
      const delay = initialMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
