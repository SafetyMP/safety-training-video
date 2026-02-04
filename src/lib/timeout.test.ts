import { describe, it, expect } from 'vitest';
import { withTimeout } from './timeout';

describe('withTimeout', () => {
  it('resolves when promise resolves before timeout', async () => {
    const p = Promise.resolve(42);
    const result = await withTimeout(p, 5000);
    expect(result).toBe(42);
  });

  it('rejects when promise rejects', async () => {
    const p = Promise.reject(new Error('fail'));
    await expect(withTimeout(p, 5000)).rejects.toThrow('fail');
  });

  it('rejects with timeout message when promise hangs', async () => {
    const p = new Promise<number>(() => {}); // never resolves
    await expect(withTimeout(p, 10, 'Custom timeout')).rejects.toThrow('Custom timeout');
  });
});
