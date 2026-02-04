import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  it('returns JSON with ok and openaiConfigured', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data).toHaveProperty('ok');
    expect(data).toHaveProperty('openaiConfigured');
    expect(typeof data.ok).toBe('boolean');
    expect(typeof data.openaiConfigured).toBe('boolean');
  });

  it('returns status 200 or 503 depending on OPENAI_API_KEY', async () => {
    const res = await GET();
    expect([200, 503]).toContain(res.status);
    const data = await res.json();
    expect(data.openaiConfigured).toBe(res.status === 200);
  });
});
