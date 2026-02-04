/**
 * Client-side API helpers: retry, safe JSON parsing, and consistent error handling.
 */

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
  errors?: ApiErrorDetail[];
  details?: Record<string, unknown>;
}

const DEFAULT_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Exponential backoff delay (aligned with server retry.ts): initialMs * 2^attemptIndex.
 */
function backoffMs(attemptIndex: number): number {
  return INITIAL_BACKOFF_MS * Math.pow(2, attemptIndex);
}

/**
 * Fetches with retries on 5xx or network failure. Uses exponential backoff.
 * Supports AbortController signal for cancellation.
 * Returns the Response.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  retries = DEFAULT_RETRIES
): Promise<Response> {
  let lastRes: Response | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      lastRes = res;
      if (res.ok) return res;
      if (res.status >= 500 && i < retries) {
        await new Promise((r) => setTimeout(r, backoffMs(i)));
        continue;
      }
      return res;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, backoffMs(i)));
    }
  }
  return lastRes!;
}

/**
 * Safely parses error body from a non-ok Response. Never throws.
 */
export async function getApiError(res: Response): Promise<ApiErrorResponse> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return { message: res.statusText || 'Request failed' };
  }
  try {
    const body = await res.json();
    const errors = Array.isArray(body?.details?.errors) ? body.details.errors : body?.errors;
    const message =
      typeof body?.error === 'string'
        ? body.error
        : Array.isArray(errors) && errors.length > 0
          ? errors.map((e: ApiErrorDetail) => e.message).join('. ')
          : res.statusText || 'Request failed';
    return {
      message,
      code: body?.code,
      errors: Array.isArray(errors) ? errors : undefined,
      details: body?.details,
    };
  } catch {
    return { message: res.statusText || 'Request failed' };
  }
}

/**
 * POST JSON, parse response safely. Use for API routes that return JSON.
 * Handles non-JSON error responses (e.g. 502 HTML) without throwing.
 * Pass signal for AbortController support.
 */
export async function fetchJson<T>(
  url: string,
  body: unknown,
  options?: { signal?: AbortSignal }
): Promise<{ ok: true; data: T } | { ok: false; error: ApiErrorResponse }> {
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    }
  );
  if (!res.ok) {
    const err = await getApiError(res);
    return { ok: false, error: err };
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return { ok: false, error: { message: 'Invalid response from server' } };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { message: 'Invalid response from server' } };
  }
}
