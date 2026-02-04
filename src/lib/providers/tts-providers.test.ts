import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTTSProvider } from './tts-providers';

describe('tts-providers', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  describe('getTTSProvider', () => {
    it('returns openai when TTS_PROVIDER is openai', () => {
      process.env.TTS_PROVIDER = 'openai';
      const provider = getTTSProvider();
      expect(provider.id).toBe('openai');
    });

    it('returns edge when TTS_PROVIDER is edge', () => {
      process.env.TTS_PROVIDER = 'edge';
      const provider = getTTSProvider();
      expect(provider.id).toBe('edge');
    });

    it('returns kokoro when TTS_PROVIDER is kokoro', () => {
      process.env.TTS_PROVIDER = 'kokoro';
      const provider = getTTSProvider();
      expect(provider.id).toBe('kokoro');
    });

    it('falls back to openai for unknown provider', () => {
      process.env.TTS_PROVIDER = 'unknown';
      const provider = getTTSProvider();
      expect(provider.id).toBe('openai');
    });

    it('falls back to openai when TTS_PROVIDER is unset', () => {
      delete process.env.TTS_PROVIDER;
      const provider = getTTSProvider();
      expect(provider.id).toBe('openai');
    });
  });

  describe('Kokoro provider - config check', () => {
    it('throws user-friendly error when REPLICATE_API_TOKEN is missing', async () => {
      process.env.TTS_PROVIDER = 'kokoro';
      delete process.env.REPLICATE_API_TOKEN;
      const provider = getTTSProvider();
      await expect(
        provider.generate({ text: 'Hello', voice: 'onyx', draft: false })
      ).rejects.toThrow('Audio generation service is not configured');
    });
  });
});
