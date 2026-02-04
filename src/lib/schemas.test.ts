import { describe, it, expect } from 'vitest';
import {
  generateScriptBodySchema,
  generateImageBodySchema,
  generateAudioBodySchema,
  scriptResultSchema,
  assembleVideoBodySchema,
} from './schemas';

describe('generateScriptBodySchema', () => {
  it('accepts valid body', () => {
    const result = generateScriptBodySchema.safeParse({
      prompt: 'Forklift safety',
      draft: true,
      audience: 'new hires',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty prompt', () => {
    const result = generateScriptBodySchema.safeParse({ prompt: '' });
    expect(result.success).toBe(false);
  });

  it('rejects prompt over max length', () => {
    const result = generateScriptBodySchema.safeParse({
      prompt: 'x'.repeat(5000),
    });
    expect(result.success).toBe(false);
  });
});

describe('generateImageBodySchema', () => {
  it('accepts valid body', () => {
    const result = generateImageBodySchema.safeParse({
      imagePrompt: 'A worker at a forklift',
      styleGuide: 'Flat cartoon',
      highQuality: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing imagePrompt', () => {
    const result = generateImageBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('generateAudioBodySchema', () => {
  it('accepts valid body and defaults voice to onyx', () => {
    const result = generateAudioBodySchema.safeParse({ text: 'Hello world' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.voice).toBe('onyx');
  });

  it('rejects text over TTS limit', () => {
    const result = generateAudioBodySchema.safeParse({
      text: 'x'.repeat(5000),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid voice', () => {
    const result = generateAudioBodySchema.safeParse({
      text: 'Hi',
      voice: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('scriptResultSchema', () => {
  it('accepts valid script from model', () => {
    const result = scriptResultSchema.safeParse({
      title: 'Forklift Safety',
      visualStyle: 'Flat cartoon, teal and orange',
      scenes: [
        { narration: 'Check the horn.', imagePrompt: 'Worker at forklift' },
        { narration: 'Look both ways.', imagePrompt: 'Worker looking left and right' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = scriptResultSchema.safeParse({
      scenes: [{ narration: 'x', imagePrompt: 'y' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty scenes', () => {
    const result = scriptResultSchema.safeParse({
      title: 'Test',
      scenes: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects scene missing narration or imagePrompt', () => {
    const result = scriptResultSchema.safeParse({
      title: 'Test',
      scenes: [{ narration: 'x' }], // missing imagePrompt
    });
    expect(result.success).toBe(false);
  });
});

describe('assembleVideoBodySchema', () => {
  it('accepts valid body', () => {
    const result = assembleVideoBodySchema.safeParse({
      scenes: [
        {
          sceneIndex: 0,
          imageBase64: 'abc',
          audioBase64: 'def',
          durationSeconds: 5,
          narration: 'Hello',
        },
      ],
      captions: true,
    });
    expect(result.success).toBe(true);
  });

  it('defaults captions to true', () => {
    const result = assembleVideoBodySchema.safeParse({
      scenes: [
        {
          sceneIndex: 0,
          imageBase64: 'a',
          audioBase64: 'b',
          durationSeconds: 3,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.captions).toBe(true);
  });

  it('rejects more than MAX_SCENES', () => {
    const scenes = Array.from({ length: 15 }, (_, i) => ({
      sceneIndex: i,
      imageBase64: 'x',
      audioBase64: 'y',
      durationSeconds: 5,
    }));
    const result = assembleVideoBodySchema.safeParse({ scenes });
    expect(result.success).toBe(false);
  });
});
