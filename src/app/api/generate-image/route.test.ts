import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/providers/image-providers', () => ({
  getImageProvider: () => ({
    generate: vi.fn().mockResolvedValue('base64image'),
  }),
  getImageProviderId: () => 'dall-e-3',
}));

vi.mock('@/lib/prompt-refinement', () => ({
  refinePromptForProvider: vi.fn().mockResolvedValue({
    refinedPrompt: 'refined prompt',
    negativePrompt: undefined,
    wasRefined: true,
  }),
  PROMPT_REFINEMENT_ENABLED: true,
}));

describe('POST /api/generate-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing imagePrompt', async () => {
    const req = new Request('http://test/api/generate-image', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty imagePrompt', async () => {
    const req = new Request('http://test/api/generate-image', {
      method: 'POST',
      body: JSON.stringify({ imagePrompt: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with imageBase64 when valid', async () => {
    const req = new Request('http://test/api/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        imagePrompt: 'Worker wearing hard hat in warehouse',
        styleGuide: 'Flat cartoon',
        sceneIndex: 0,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('imageBase64');
  });
});
