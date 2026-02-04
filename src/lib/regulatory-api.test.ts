import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchRegulationSection,
  fetchRegulationsForCitations,
  getRegulatoryApiStatus,
  clearRegulatoryCache,
} from './regulatory-api';

// Mock fetch - eCFR API may be slow or restricted in CI
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('regulatory-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRegulatoryCache();
  });

  describe('fetchRegulationSection', () => {
    it('returns null for unknown citation', async () => {
      const result = await fetchRegulationSection('Unknown ref');
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null for invalid citation format', async () => {
      const result = await fetchRegulationSection('OSHA general');
      expect(result).toBeNull();
    });

    it('fetches and parses valid section when API returns JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            part: { abstract: 'Powered industrial trucks. Scope. This section...' },
          }),
      });

      const result = await fetchRegulationSection('OSHA 1910.178');
      expect(result).not.toBeNull();
      expect(result?.citation).toBe('29 CFR 1910.178');
      expect(result?.text).toContain('Powered industrial trucks');
      expect(result?.source).toBe('eCFR.gov');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('returns null when API returns non-JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
      });

      const result = await fetchRegulationSection('OSHA 1910.178');
      expect(result).toBeNull();
    });

    it('returns null when API returns 404', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await fetchRegulationSection('OSHA 1910.178');
      expect(result).toBeNull();
    });
  });

  describe('fetchRegulationsForCitations', () => {
    it('returns empty when no valid citations', async () => {
      const { context, snippets } = await fetchRegulationsForCitations([]);
      expect(context).toBe('');
      expect(snippets).toEqual([]);
    });

    it('deduplicates citations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            part: { abstract: 'Test regulation text.' },
          }),
      });

      const { snippets } = await fetchRegulationsForCitations([
        'OSHA 1910.178',
        '29 CFR 1910.178',
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(snippets).toHaveLength(1);
    });
  });

  describe('getRegulatoryApiStatus', () => {
    it('returns enabled by default', () => {
      const status = getRegulatoryApiStatus();
      expect(status.enabled).toBe(true);
      expect(status.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('respects REGULATORY_API_ENABLED=false', () => {
      const prev = process.env.REGULATORY_API_ENABLED;
      process.env.REGULATORY_API_ENABLED = 'false';
      const status = getRegulatoryApiStatus();
      expect(status.enabled).toBe(false);
      process.env.REGULATORY_API_ENABLED = prev;
    });
  });

  describe('clearRegulatoryCache', () => {
    it('clears cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            part: { abstract: 'Cached text.' },
          }),
      });

      await fetchRegulationSection('OSHA 1910.178');
      let status = getRegulatoryApiStatus();
      expect(status.regulationsCached).toBeGreaterThan(0);

      clearRegulatoryCache();
      status = getRegulatoryApiStatus();
      expect(status.regulationsCached).toBe(0);
      expect(status.lastFetch).toBeNull();
    });
  });
});
