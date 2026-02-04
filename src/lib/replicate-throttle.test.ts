import { describe, it, expect, vi } from 'vitest';
import { withReplicateThrottle } from './replicate-throttle';

describe('withReplicateThrottle', () => {
  it('executes fn and returns result', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withReplicateThrottle(fn, { ms: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('serializes sequential calls', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await withReplicateThrottle(fn, { ms: 0 });
    await withReplicateThrottle(fn, { ms: 0 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
