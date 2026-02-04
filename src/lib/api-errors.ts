/**
 * Standardized API error response schema.
 * All routes use this format for consistent client handling.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'TIMEOUT'
  | 'SERVICE_UNAVAILABLE';

export interface ApiErrorResponse {
  error: string;
  code?: ErrorCode;
  details?: Record<string, unknown>;
}

/** Build a standardized error JSON body. */
export function apiError(
  message: string,
  options?: { code?: ErrorCode; details?: Record<string, unknown> }
): ApiErrorResponse {
  return {
    error: message,
    ...(options?.code && { code: options.code }),
    ...(options?.details && { details: options.details }),
  };
}
