import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(100);
    const result = await withRetry(fn, { attempts: 3, initialMs: 5 });
    expect(result).toBe(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));
    await expect(withRetry(fn, { attempts: 3, initialMs: 5 })).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses default attempts and initialMs when not provided', async () => {
    const fn = vi.fn().mockResolvedValue(1);
    const result = await withRetry(fn);
    expect(result).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
