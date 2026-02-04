/**
 * Throttles Replicate API calls to stay under rate limits.
 * Replicate: 6 req/min, burst of 1 when account has <$5 credit.
 * We space calls by REPLICATE_THROTTLE_MS (default 10s) to stay under limit.
 */

import { REPLICATE_THROTTLE_MS as DEFAULT_MS } from '@/lib/constants';

let lastCallTime = 0;
let pending: Promise<void> = Promise.resolve();

/**
 * Waits for the throttle, then executes fn. Ensures minimum delay between Replicate API calls.
 */
export async function withReplicateThrottle<T>(
  fn: () => Promise<T>,
  options?: { ms?: number }
): Promise<T> {
  pending = pending.then(async () => {
    const ms = options?.ms ?? DEFAULT_MS;
    const elapsed = Date.now() - lastCallTime;
    if (elapsed < ms && lastCallTime > 0) {
      await new Promise((r) => setTimeout(r, ms - elapsed));
    }
  });

  await pending;
  lastCallTime = Date.now();
  return fn();
}
