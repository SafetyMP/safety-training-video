import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockParse = vi.fn();
const mockCreate = vi.fn();
vi.mock('openai/helpers/zod', () => ({ zodResponseFormat: vi.fn() }));
vi.mock('@/lib/openai-client', () => ({
  openai: {
    beta: { chat: { completions: { parse: (...args: unknown[]) => mockParse(...args) } } },
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  },
}));
vi.mock('@/lib/regulatory-api', () => ({
  fetchRegulationsForCitations: vi.fn().mockResolvedValue({ context: '', snippets: [] }),
  getRegulatoryApiStatus: vi.fn().mockReturnValue({ enabled: true, effectiveDate: '2024-01-15' }),
}));
vi.mock('@/lib/fact-verification', () => ({
  verifyScriptFacts: vi.fn().mockResolvedValue([]),
}));

describe('POST /api/generate-script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for empty body', async () => {
    const req = new Request('http://test/api/generate-script', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toBeDefined();
  });

  it('returns 400 for missing prompt', async () => {
    const req = new Request('http://test/api/generate-script', {
      method: 'POST',
      body: JSON.stringify({ prompt: '', draft: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 for invalid body (non-JSON)', async () => {
    const req = new Request('http://test/api/generate-script', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect([400, 500]).toContain(res.status);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('returns 200 with script when OpenAI succeeds', async () => {
    const scriptData = {
      title: 'Forklift Safety',
      visualStyle: 'Flat cartoon style',
      scenes: [
        { narration: 'Always sound the horn.', imagePrompt: 'Worker at forklift' },
        { narration: 'Check your blind spots.', imagePrompt: 'Warehouse aisle' },
      ],
    };
    mockParse.mockResolvedValue({
      choices: [{ message: { parsed: scriptData } }],
    });

    const req = new Request('http://test/api/generate-script', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'forklift safety training', draft: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe('Forklift Safety');
    expect(data.scenes).toHaveLength(2);
    expect(data.scenes[0]).toHaveProperty('narration');
    expect(data.scenes[0]).toHaveProperty('imagePrompt');
  });
});
