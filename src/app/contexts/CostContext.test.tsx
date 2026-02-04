/**
 * @vitest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostProvider, useCostContext, estimateSceneCost, estimateVideoCost } from './CostContext';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <CostProvider>{children}</CostProvider>;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          videoProvider: 'off',
          imageProvider: 'dall-e-3',
          ttsProvider: 'openai',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    )
  );
});

describe('CostContext', () => {
  describe('estimateSceneCost', () => {
    it('returns positive cost for standard image + audio', () => {
      const cost = estimateSceneCost(200, { highQuality: false, draft: true });
      expect(cost).toBeGreaterThan(0);
    });

    it('returns higher cost for HD + standard audio', () => {
      const standard = estimateSceneCost(200, { highQuality: false, draft: false });
      const hd = estimateSceneCost(200, { highQuality: true, draft: false });
      expect(hd).toBeGreaterThanOrEqual(standard);
    });

    it('uses config when provided for video mode', () => {
      const config = {
        videoProvider: 'wan' as const,
        imageProvider: 'dall-e-3',
        ttsProvider: 'openai',
      };
      const cost = estimateSceneCost(200, { highQuality: false, draft: false, useVideo: true }, config);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('estimateVideoCost', () => {
    it('includes script cost plus scene costs', () => {
      const cost = estimateVideoCost(3, { highQuality: false, draft: true });
      expect(cost).toBeGreaterThan(0.002); // EST_COST_SCRIPT
    });

    it('scales with scene count', () => {
      const cost3 = estimateVideoCost(3, { highQuality: false, draft: true });
      const cost6 = estimateVideoCost(6, { highQuality: false, draft: true });
      expect(cost6).toBeGreaterThan(cost3);
    });
  });

  describe('useCostContext', () => {
    it('starts with zero total cost', async () => {
      const { result } = renderHook(() => useCostContext(), { wrapper });
      // Wait for the async fetchProviderConfig to complete
      await waitFor(() => {
        expect(result.current.providerConfig).not.toBeNull();
      });
      expect(result.current.totalCost).toBe(0);
    });

    it('addCost increases totalCost', async () => {
      const { result } = renderHook(() => useCostContext(), { wrapper });
      await waitFor(() => {
        expect(result.current.providerConfig).not.toBeNull();
      });
      act(() => result.current.addCost(0.05));
      expect(result.current.totalCost).toBe(0.05);
    });

    it('reset clears totalCost', async () => {
      const { result } = renderHook(() => useCostContext(), { wrapper });
      await waitFor(() => {
        expect(result.current.providerConfig).not.toBeNull();
      });
      act(() => result.current.addCost(0.1));
      expect(result.current.totalCost).toBe(0.1);
      act(() => result.current.reset());
      expect(result.current.totalCost).toBe(0);
    });

    it('canProceed returns false when blocked', async () => {
      const { result } = renderHook(() => useCostContext(), { wrapper });
      await waitFor(() => {
        expect(result.current.providerConfig).not.toBeNull();
      });
      act(() => result.current.addCost(1)); // above SESSION_COST_BLOCK (0.5)
      expect(result.current.canProceed()).toBe(false);
    });
  });
});
