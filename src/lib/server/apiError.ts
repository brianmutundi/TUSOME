import { NextResponse } from 'next/server';
import { AnalyticsAPIError, type AnalyticsErrorCode } from '@/lib/analytics/errors';

/**
 * One error envelope for every route handler:
 *   { error: { code, message, details? } }
 *
 * Clients can branch on `code`; `message` is always safe to display.
 */

const STATUS_BY_CODE: Record<AnalyticsErrorCode, number> = {
  NOT_AUTHENTICATED: 401,
  MISSING_TENANT: 400,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  ABORTED: 499,
  CONTRACT_ERROR: 500,
  SERVER_ERROR: 500,
  UNKNOWN: 500,
  RATE_LIMITED: 429,
};

export function apiError(
  code: AnalyticsErrorCode,
  message: string,
  options: { status?: number; details?: unknown } = {}
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options.details === undefined ? {} : { details: options.details }),
      },
    },
    { status: options.status ?? STATUS_BY_CODE[code] }
  );
}

/**
 * Map a Supabase/PostgREST error into the same envelope. Raw provider text is
 * dropped for 500s unless the route is admin-only and the text comes from our
 * own RAISE EXCEPTION (pass `exposeServerMessage`).
 */
export function apiErrorFromSupabase(
  error: { code?: string; message?: string; details?: string },
  options: { status?: number; exposeServerMessage?: boolean } = {}
) {
  const mapped = AnalyticsAPIError.fromSupabaseError(error);
  const message =
    mapped.code === 'SERVER_ERROR' && !options.exposeServerMessage
      ? 'Something went wrong on the server.'
      : mapped.message;
  return apiError(mapped.code, message, { status: options.status, details: mapped.details });
}
