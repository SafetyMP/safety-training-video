import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/config', () => {
  it('returns JSON with expected provider fields', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('videoProvider');
    expect(data).toHaveProperty('imageProvider');
    expect(data).toHaveProperty('ttsProvider');
    expect(typeof data.videoProvider).toBe('string');
    expect(typeof data.imageProvider).toBe('string');
    expect(typeof data.ttsProvider).toBe('string');
  });

  it('includes regulatoryApi when enabled', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data).toHaveProperty('regulatoryApi');
    if (data.regulatoryApi) {
      expect(data.regulatoryApi).toHaveProperty('effectiveDate');
      expect(data.regulatoryApi.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
