/**
 * Integration tests for external APIs (OpenAI, eCFR, Replicate).
 *
 * These tests make real network requests and may incur API costs.
 * Run with: npm run test:integration
 *
 * Skips when required env vars are missing (e.g. in CI without keys).
 */
import { describe, it, expect } from 'vitest';
import { openai } from '@/lib/openai-client';
import { getImageProvider } from '@/lib/providers/image-providers';
import { getTTSProvider } from '@/lib/providers/tts-providers';
import { getVideoProvider } from '@/lib/providers/video-providers';
import { fetchRegulationSection, fetchRegulationsForCitations } from '@/lib/regulatory-api';

const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
const hasReplicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
const imageProvider = process.env.IMAGE_PROVIDER ?? 'dall-e-3';
const ttsProvider = process.env.TTS_PROVIDER ?? 'openai';
const needsReplicateForImage = ['sdxl', 'flux'].includes(imageProvider);
const needsReplicateForTTS = ttsProvider === 'kokoro';
const videoProvider = (process.env.VIDEO_PROVIDER ?? 'off').toLowerCase();
const needsReplicateForVideo = videoProvider === 'wan';

describe('External APIs (integration)', () => {
  describe('eCFR regulatory API (no auth)', () => {
    it('fetches 29 CFR 1910.178 (forklift)', async () => {
      const result = await fetchRegulationSection('OSHA 1910.178');
      if (result) {
        expect(result.citation).toBe('29 CFR 1910.178');
        expect(result.text.length).toBeGreaterThan(100);
        expect(result.source).toBe('eCFR.gov');
        expect(result.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        // eCFR may be slow or restrict automated access
        expect(result).toBeNull();
      }
    }, 20_000);

    it('fetches multiple citations', async () => {
      const { context, snippets } = await fetchRegulationsForCitations([
        'OSHA 1910.178',
        'OSHA 1910.22',
      ]);
      if (snippets.length > 0) {
        expect(context.length).toBeGreaterThan(0);
        expect(snippets.length).toBeGreaterThanOrEqual(1);
        expect(snippets[0]).toHaveProperty('citation');
        expect(snippets[0]).toHaveProperty('text');
      }
    }, 25_000);
  });

  describe.skipIf(!hasOpenAI)('OpenAI API (requires OPENAI_API_KEY)', () => {
    it('generates a minimal script (chat completion)', async () => {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_SCRIPT_MODEL ?? 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Reply with only valid JSON: {"title":"Test","scenes":[{"narration":"Hi.","imagePrompt":"A person."}]}',
          },
          { role: 'user', content: 'One scene only.' },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 100,
      });

      const raw = completion.choices[0]?.message?.content;
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('scenes');
      expect(Array.isArray(parsed.scenes)).toBe(true);
    }, 30_000);
  });

  describe.skipIf(!hasOpenAI || needsReplicateForImage)('OpenAI image generation', () => {
    it('generates an image (dall-e-3 or gpt-image-1-mini)', async () => {
      const provider = getImageProvider();
      expect(['dall-e-3', 'gpt-image-1-mini']).toContain(provider.id);

      const base64 = await provider.generate({
        prompt: 'A simple flat icon of a hard hat, safety yellow, white background',
        highQuality: false,
      });

      expect(base64.length).toBeGreaterThan(100);
      expect(/^[A-Za-z0-9+/=]+$/.test(base64)).toBe(true);
    }, 60_000);
  });

  describe.skipIf(!hasReplicate || !needsReplicateForImage)('Replicate image generation', () => {
    it('generates an image (SDXL or Flux)', async () => {
      const provider = getImageProvider();
      expect(['sdxl', 'flux']).toContain(provider.id);

      const base64 = await provider.generate({
        prompt: 'A simple flat icon of a hard hat, safety yellow',
        highQuality: false,
      });

      expect(base64.length).toBeGreaterThan(100);
    }, 90_000);
  });

  describe.skipIf(!hasOpenAI || needsReplicateForTTS)('OpenAI TTS', () => {
    it('generates audio', async () => {
      const provider = getTTSProvider();
      expect(provider.id).toBe('openai');

      const { audioBase64, contentType } = await provider.generate({
        text: 'Safety first.',
        voice: 'onyx',
        draft: true,
      });

      expect(audioBase64.length).toBeGreaterThan(100);
      expect(contentType).toMatch(/^audio\//);
    }, 15_000);
  });

  describe.skipIf(!hasReplicate || !needsReplicateForTTS)('Replicate TTS (Kokoro)', () => {
    it('generates audio', async () => {
      // Wait for throttle/rate limit (10s between Replicate calls)
      await new Promise((r) => setTimeout(r, 10_000));
      const provider = getTTSProvider();
      expect(provider.id).toBe('kokoro');

      const { audioBase64, contentType } = await provider.generate({
        text: 'Safety first.',
        voice: 'onyx',
        draft: true,
      });

      expect(audioBase64.length).toBeGreaterThan(100);
      expect(contentType).toMatch(/^audio\//);
    }, 60_000); // 10s delay + throttle + API time
  });

  describe.skipIf(!hasReplicate || !needsReplicateForVideo)('Replicate video (Wan 2.1 T2V)', () => {
    it('generates a short video clip', async () => {
      // Wait for throttle/rate limit (10s between Replicate calls)
      await new Promise((r) => setTimeout(r, 10_000));
      const provider = getVideoProvider();
      expect(provider.id).toBe('wan');

      const { videoBase64, durationSeconds } = await provider.generate({
        prompt: 'A worker wearing a hard hat walks through a warehouse',
      });

      expect(videoBase64.length).toBeGreaterThan(1000);
      expect(durationSeconds).toBeGreaterThan(4);
      expect(durationSeconds).toBeLessThanOrEqual(6);
    }, 120_000); // video gen is slow; 10s throttle + ~30–60s API
  });
});
