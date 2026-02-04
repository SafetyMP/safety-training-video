import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/providers/tts-providers', () => ({
  getTTSProvider: () => ({
    generate: vi.fn().mockResolvedValue({
      audioBase64: 'base64audio',
      contentType: 'audio/mpeg',
    }),
  }),
}));

describe('POST /api/generate-audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing text', async () => {
    const req = new Request('http://test/api/generate-audio', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty text', async () => {
    const req = new Request('http://test/api/generate-audio', {
      method: 'POST',
      body: JSON.stringify({ text: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with audioBase64 and contentType when valid', async () => {
    const req = new Request('http://test/api/generate-audio', {
      method: 'POST',
      body: JSON.stringify({ text: 'Always wear your hard hat in the warehouse.', voice: 'onyx' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('audioBase64');
    expect(data).toHaveProperty('contentType');
  });
});
