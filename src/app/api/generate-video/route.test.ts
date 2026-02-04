import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockIsEnabled = vi.fn();
vi.mock('@/lib/providers/video-providers', () => ({
  isVideoProviderEnabled: () => mockIsEnabled(),
  getVideoProviderId: () => 'wan',
  getVideoProvider: () => ({
    generate: vi.fn().mockResolvedValue({
      videoBase64: 'base64video',
      durationSeconds: 5,
    }),
  }),
}));

vi.mock('@/lib/prompt-refinement', () => ({
  refinePromptForProvider: vi.fn().mockResolvedValue({
    refinedPrompt: 'refined video prompt',
    wasRefined: true,
  }),
  PROMPT_REFINEMENT_ENABLED: true,
}));

describe('POST /api/generate-video', () => {
  beforeEach(() => {
    mockIsEnabled.mockReset();
  });

  it('returns 400 when video provider is disabled', async () => {
    mockIsEnabled.mockReturnValue(false);

    const req = new Request('http://test/api/generate-video', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Worker in warehouse' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('not available');
  });

  it('returns 400 for missing prompt when enabled', async () => {
    mockIsEnabled.mockReturnValue(true);

    const req = new Request('http://test/api/generate-video', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with videoBase64 when valid and enabled', async () => {
    mockIsEnabled.mockReturnValue(true);

    const req = new Request('http://test/api/generate-video', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Worker wearing PPE in warehouse',
        styleGuide: 'Flat cartoon style',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('videoBase64');
    expect(data).toHaveProperty('durationSeconds');
  });
});
