/**
 * Wraps API route handlers with shared behavior: request ID, rate limit, and error logging.
 * Use for POST routes that call external APIs and need rate limiting.
 */

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import { getRequestId, logError, logInfo } from '@/lib/logger';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export type ApiHandlerContext = { requestId: string; ip: string };

export type ApiHandler = (
  request: Request,
  ctx: ApiHandlerContext
) => Promise<NextResponse>;

/**
 * Wraps an API handler with:
 * - requestId and client IP from context
 * - rate limit check (429 if exceeded)
 * - request/response logging
 * - try/catch with logError and 500 JSON response on throw
 */
export function withApiHandler(routeName: string, handler: ApiHandler) {
  return async (request: Request): Promise<NextResponse> => {
    const requestId = getRequestId(request);
    const ip = getClientIp(request);
    const startTime = Date.now();

    // Log incoming request
    logInfo(`→ ${request.method} /api/${routeName}`, { requestId, route: routeName, ip });

    if (!(await rateLimit(ip))) {
      logInfo(`← 429 rate limited`, { requestId, route: routeName, durationMs: Date.now() - startTime });
      return NextResponse.json(
        apiError('Too many requests. Please try again later.', { code: 'RATE_LIMITED' }),
        { status: 429 }
      );
    }

    try {
      const response = await handler(request, { requestId, ip });
      const durationMs = Date.now() - startTime;
      logInfo(`← ${response.status}`, { requestId, route: routeName, durationMs });
      return response;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logError(routeName, err, requestId);
      logInfo(`← 500 error`, { requestId, route: routeName, durationMs });
      return NextResponse.json(
        apiError(err instanceof Error ? err.message : 'Request failed', {
          code: 'INTERNAL_ERROR',
          details: { requestId },
        }),
        { status: 500 }
      );
    }
  };
}
