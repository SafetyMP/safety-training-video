import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getApiError, fetchWithRetry, fetchJson } from './api-client';

describe('api-client', () => {
  describe('getApiError', () => {
    it('parses standardized error format with body.error', async () => {
      const res = new Response(
        JSON.stringify({ error: 'Validation failed', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
      const err = await getApiError(res);
      expect(err.message).toBe('Validation failed');
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('parses body.details.errors for validation details', async () => {
      const res = new Response(
        JSON.stringify({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: { errors: [{ path: 'prompt', message: 'Required' }] },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
      const err = await getApiError(res);
      expect(err.message).toBe('Invalid request');
      expect(err.errors).toEqual([{ path: 'prompt', message: 'Required' }]);
    });

    it('falls back to statusText for non-JSON response', async () => {
      const res = new Response('body', { status: 404, statusText: 'Not Found' });
      const err = await getApiError(res);
      expect(err.message).toBe('Not Found');
    });

    it('falls back to "Request failed" for empty body', async () => {
      const res = new Response('', { status: 500 });
      const err = await getApiError(res);
      expect(err.message).toMatch(/failed/i);
    });
  });

  describe('fetchWithRetry', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('retries on 5xx', async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const res = await fetchWithRetry('/api/test', {}, 1);
      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry on AbortError', async () => {
      const fetchMock = vi.mocked(fetch);
      const aborter = new AbortController();
      fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

      await expect(
        fetchWithRetry('/api/test', { signal: aborter.signal })
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
