import { describe, it, expect } from 'vitest';
import {
  getTopicsForPrompt,
  getContextForPrompt,
  validateContentAgainstReference,
  getAllEHSTopics,
} from './ehs-reference';

describe('ehs-reference', () => {
  describe('getTopicsForPrompt', () => {
    it('returns forklift topic for forklift-related prompts', () => {
      const topics = getTopicsForPrompt('A short cartoon about forklift safety in a warehouse');
      expect(topics.some((t) => t.id === 'forklift')).toBe(true);
    });

    it('returns slip-trip-fall topic for walkway/spill prompts', () => {
      const topics = getTopicsForPrompt('Slip and trip hazards: keeping walkways clear');
      expect(topics.some((t) => t.id === 'slip-trip-fall')).toBe(true);
    });

    it('returns PPE topic for PPE-related prompts', () => {
      const topics = getTopicsForPrompt('PPE basics: hard hat, safety glasses, high-vis vest');
      expect(topics.some((t) => t.id === 'ppe')).toBe(true);
    });

    it('returns fire-evacuation topic for fire/exit prompts', () => {
      const topics = getTopicsForPrompt('Fire evacuation: knowing exits, assembly point');
      expect(topics.some((t) => t.id === 'fire-evacuation')).toBe(true);
    });

    it('returns empty when no keywords match', () => {
      const topics = getTopicsForPrompt('How to make coffee');
      expect(topics).toHaveLength(0);
    });

    it('returns confined-space topic for confined space prompts', () => {
      const topics = getTopicsForPrompt('Permit-required confined space entry training');
      expect(topics.some((t) => t.id === 'confined-space')).toBe(true);
    });

    it('returns fall-protection topic for fall protection prompts', () => {
      const topics = getTopicsForPrompt('Fall protection and harness training');
      expect(topics.some((t) => t.id === 'fall-protection')).toBe(true);
    });

    it('returns electrical topic for electrical safety prompts', () => {
      const topics = getTopicsForPrompt('Electrical safety and lockout');
      expect(topics.some((t) => t.id === 'electrical')).toBe(true);
    });
  });

  describe('getContextForPrompt', () => {
    it('returns empty string when no topics match', () => {
      expect(getContextForPrompt('How to make coffee')).toBe('');
    });

    it('returns reference context when topics match', () => {
      const ctx = getContextForPrompt('forklift safety');
      expect(ctx).toContain('Reference facts');
      expect(ctx).toContain('forklift');
      expect(ctx).toContain('Key facts');
      expect(ctx).toContain('Best practices');
    });
  });

  describe('validateContentAgainstReference', () => {
    it('returns topicIds from prompt when provided via options', () => {
      const r = validateContentAgainstReference('Some content', {
        topicIds: ['forklift', 'ppe'],
      });
      expect(r.topicIds).toEqual(['forklift', 'ppe']);
    });

    it('flags missing shouldMention when content omits them', () => {
      const r = validateContentAgainstReference('Random text about nothing.', {
        topicIds: ['forklift'],
      });
      expect(r.missingRecommendations.length).toBeGreaterThan(0);
      expect(r.missingRecommendations.some((m) => m.includes('horn') || m.includes('forklift'))).toBe(true);
    });

    it('flags terminology suggestions when avoid-phrases appear', () => {
      const r = validateContentAgainstReference(
        'Use MSDS before mixing chemicals. Check the hazcom program.',
        { topicIds: ['hazard-communication'] }
      );
      expect(r.terminologySuggestions.length).toBeGreaterThan(0);
      expect(r.terminologySuggestions.some((s) => s.prefer === 'Safety Data Sheet')).toBe(true);
    });

    it('returns empty arrays when restrictToTopics and no valid topics', () => {
      const r = validateContentAgainstReference('Hello world', {
        topicIds: ['nonexistent'],
        restrictToTopics: true,
      });
      expect(r.topicIds).toEqual([]);
      expect(r.warnings).toEqual([]);
      expect(r.terminologySuggestions).toEqual([]);
      expect(r.mythsFlagged).toEqual([]);
      expect(r.missingRecommendations).toEqual([]);
    });
  });

  describe('getAllEHSTopics', () => {
    it('returns all EHS topics (20+)', () => {
      const topics = getAllEHSTopics();
      expect(topics.length).toBeGreaterThanOrEqual(20);
      expect(topics.map((t) => t.id)).toContain('forklift');
      expect(topics.map((t) => t.id)).toContain('slip-trip-fall');
      expect(topics.map((t) => t.id)).toContain('ppe');
      expect(topics.map((t) => t.id)).toContain('fire-evacuation');
      expect(topics.map((t) => t.id)).toContain('confined-space');
      expect(topics.map((t) => t.id)).toContain('fall-protection');
      expect(topics.map((t) => t.id)).toContain('electrical');
    });
  });
});
