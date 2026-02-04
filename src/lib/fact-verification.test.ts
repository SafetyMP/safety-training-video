import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyScriptFacts } from './fact-verification';
import type { ScriptResult } from './types';

const mockCreate = vi.fn();
vi.mock('@/lib/openai-client', () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  },
}));

vi.mock('@/lib/ehs-reference', () => ({
  getVerificationContextForTopics: (topicIds: string[]) =>
    topicIds.length > 0 ? 'Reference context for topics' : '',
}));

describe('verifyScriptFacts', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when script has no scenes', async () => {
    const script: ScriptResult = { title: 'Test', scenes: [] };
    const result = await verifyScriptFacts(script, ['forklift']);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns empty array when topicIds is empty', async () => {
    const script: ScriptResult = {
      title: 'Test',
      scenes: [{ narration: 'Sound the horn.', imagePrompt: 'Worker at forklift' }],
    };
    const result = await verifyScriptFacts(script, []);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns parsed results when API returns valid claims', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              claims: [
                {
                  claim: 'Sound the horn at blind corners.',
                  sceneIndex: 0,
                  type: 'procedure',
                  status: 'verified',
                  confidence: 0.9,
                  source: 'OSHA 1910.178',
                },
              ],
            }),
          },
        },
      ],
    } as never);

    const script: ScriptResult = {
      title: 'Forklift Safety',
      scenes: [
        { narration: 'Sound the horn at blind corners.', imagePrompt: 'Forklift in warehouse' },
      ],
    };
    const result = await verifyScriptFacts(script, ['forklift']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      claim: 'Sound the horn at blind corners.',
      sceneIndex: 0,
      type: 'procedure',
      status: 'verified',
      confidence: 0.9,
      source: 'OSHA 1910.178',
    });
    expect(mockCreate).toHaveBeenCalled();
  });

  it('returns empty array when API returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    } as never);

    const script: ScriptResult = {
      title: 'Test',
      scenes: [{ narration: 'Test.', imagePrompt: 'Test' }],
    };
    const result = await verifyScriptFacts(script, ['forklift']);
    expect(result).toEqual([]);
  });

  it('returns empty array when API throws', async () => {
    mockCreate.mockRejectedValue(new Error('API error'));

    const script: ScriptResult = {
      title: 'Test',
      scenes: [{ narration: 'Test.', imagePrompt: 'Test' }],
    };
    const result = await verifyScriptFacts(script, ['forklift']);
    expect(result).toEqual([]);
  });

  it('filters out invalid claim objects', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              claims: [
                { claim: 'Valid claim', sceneIndex: 0, type: 'regulation', status: 'verified', confidence: 0.8 },
                { claim: 123, sceneIndex: 0, type: 'other', status: 'verified', confidence: 0.5 },
                { invalid: 'structure' },
              ],
            }),
          },
        },
      ],
    } as never);

    const script: ScriptResult = {
      title: 'Test',
      scenes: [{ narration: 'Test.', imagePrompt: 'Test' }],
    };
    const result = await verifyScriptFacts(script, ['forklift']);
    expect(result).toHaveLength(1);
    expect(result[0].claim).toBe('Valid claim');
  });
});
