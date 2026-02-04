/**
 * Simple request-scoped logging. Include request ID when available for tracing.
 * 
 * For production, consider replacing with a structured logger like pino:
 *   import pino from 'pino';
 *   export const logger = pino({ level: 'info' });
 */

export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? 'no-id';
}

interface LogContext {
  requestId?: string;
  route?: string;
  ip?: string;
  [key: string]: unknown;
}

/**
 * Log an info-level message with optional context.
 */
export function logInfo(message: string, context?: LogContext): void {
  const parts = [`[INFO]`, message];
  if (context?.requestId) parts.push(`requestId=${context.requestId}`);
  if (context?.route) parts.push(`route=${context.route}`);
  if (context?.ip) parts.push(`ip=${context.ip}`);
  // Add other context fields
  const extra = Object.entries(context ?? {})
    .filter(([k]) => !['requestId', 'route', 'ip'].includes(k))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');
  if (extra) parts.push(extra);
  console.warn(parts.join(' '));
}

/**
 * Log a warning message with optional context.
 */
export function logWarn(message: string, context?: LogContext): void {
  const parts = [`[WARN]`, message];
  if (context?.requestId) parts.push(`requestId=${context.requestId}`);
  if (context?.route) parts.push(`route=${context.route}`);
  console.warn(parts.join(' '));
}

/**
 * Log an error with request context for tracing.
 */
export function logError(
  route: string,
  err: unknown,
  requestId?: string
): void {
  const id = requestId ?? 'no-id';
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[ERROR] route=${route} requestId=${id} error=${message}`, stack ?? err);
}
