import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getImageProvider } from './image-providers';

describe('image-providers', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  describe('getImageProvider', () => {
    it('returns dall-e-3 when IMAGE_PROVIDER is dall-e-3', () => {
      process.env.IMAGE_PROVIDER = 'dall-e-3';
      const provider = getImageProvider();
      expect(provider.id).toBe('dall-e-3');
    });

    it('returns gpt-image-1-mini when IMAGE_PROVIDER is gpt-image-1-mini', () => {
      process.env.IMAGE_PROVIDER = 'gpt-image-1-mini';
      const provider = getImageProvider();
      expect(provider.id).toBe('gpt-image-1-mini');
    });

    it('returns sdxl when IMAGE_PROVIDER is sdxl', () => {
      process.env.IMAGE_PROVIDER = 'sdxl';
      const provider = getImageProvider();
      expect(provider.id).toBe('sdxl');
    });

    it('returns flux when IMAGE_PROVIDER is flux', () => {
      process.env.IMAGE_PROVIDER = 'flux';
      const provider = getImageProvider();
      expect(provider.id).toBe('flux');
    });

    it('falls back to dall-e-3 for unknown provider', () => {
      process.env.IMAGE_PROVIDER = 'unknown';
      const provider = getImageProvider();
      expect(provider.id).toBe('dall-e-3');
    });

    it('falls back to dall-e-3 when IMAGE_PROVIDER is unset', () => {
      delete process.env.IMAGE_PROVIDER;
      const provider = getImageProvider();
      expect(provider.id).toBe('dall-e-3');
    });
  });

  describe('SDXL provider - config check', () => {
    it('throws user-friendly error when REPLICATE_API_TOKEN is missing', async () => {
      process.env.IMAGE_PROVIDER = 'sdxl';
      delete process.env.REPLICATE_API_TOKEN;
      const provider = getImageProvider();
      await expect(
        provider.generate({ prompt: 'test', highQuality: false })
      ).rejects.toThrow('Image generation service is not configured');
    });
  });

  describe('Flux provider - config check', () => {
    it('throws user-friendly error when REPLICATE_API_TOKEN is missing', async () => {
      process.env.IMAGE_PROVIDER = 'flux';
      delete process.env.REPLICATE_API_TOKEN;
      const provider = getImageProvider();
      await expect(
        provider.generate({ prompt: 'test', highQuality: false })
      ).rejects.toThrow('Image generation service is not configured');
    });
  });
});
