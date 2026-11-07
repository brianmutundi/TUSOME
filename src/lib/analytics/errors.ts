/**
 * Consistent error types for the TUSOME analytics API layer.
 *
 * All API functions throw AnalyticsAPIError with a machine-readable code
 * and a human-readable message. This ensures consistent error handling
 * across all consumers.
 */

export type AnalyticsErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'MISSING_TENANT'
  | 'ACCESS_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'ABORTED'
  | 'CONTRACT_ERROR'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export class AnalyticsAPIError extends Error {
  readonly code: AnalyticsErrorCode;
  readonly details?: unknown;
  readonly statusCode?: number;
  /**
   * The server's own text when `message` was replaced with a generic one (42501 becomes
   * "Permission denied"). For matching against known messages only; never show it raw.
   */
  readonly serverMessage?: string;

  constructor(
    code: AnalyticsErrorCode,
    message: string,
    details?: unknown,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AnalyticsAPIError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }

  static fromSupabaseError(error: { code?: string; message?: string; details?: string }): AnalyticsAPIError {
    const message = error.message || 'An unexpected error occurred';

    // Map Supabase/PostgreSQL error codes to our error codes
    if (error.code === 'P0001') {
      // RAISE EXCEPTION from our RPCs
      if (message.includes('Missing tenant claim')) return new AnalyticsAPIError('MISSING_TENANT', message);
      if (message.includes('Access denied')) return new AnalyticsAPIError('ACCESS_DENIED', message, undefined, 403);
      if (message.includes('not found')) return new AnalyticsAPIError('NOT_FOUND', message, undefined, 404);
      if (message.includes('Invalid') || message.includes('required')) return new AnalyticsAPIError('VALIDATION_ERROR', message, undefined, 422);
      if (message.includes('concurrent') || message.includes('conflict')) return new AnalyticsAPIError('CONFLICT', message, undefined, 409);
      return new AnalyticsAPIError('SERVER_ERROR', message, undefined, 500);
    }

    if (error.code === '23505') {
      return new AnalyticsAPIError('CONFLICT', 'A record with this value already exists', error.details, 409);
    }

    if (error.code === '23503') {
      return new AnalyticsAPIError('VALIDATION_ERROR', 'Referenced record does not exist', error.details, 422);
    }

    if (error.code === '42501') {
      const denied = new AnalyticsAPIError('ACCESS_DENIED', 'Permission denied', error.details, 403);
      // readonly is compile-time only; set once here so the constructor signature stays as it was.
      (denied as { serverMessage?: string }).serverMessage = message;
      return denied;
    }

    return new AnalyticsAPIError('SERVER_ERROR', message, error.details, 500);
  }

  static validation(message: string, details?: unknown): AnalyticsAPIError {
    return new AnalyticsAPIError('VALIDATION_ERROR', message, details, 422);
  }

  static notFound(resource: string, id?: string): AnalyticsAPIError {
    return new AnalyticsAPIError('NOT_FOUND', `${resource} not found${id ? `: ${id}` : ''}`, undefined, 404);
  }

  static accessDenied(action?: string): AnalyticsAPIError {
    return new AnalyticsAPIError('ACCESS_DENIED', action ? `Access denied: ${action}` : 'Access denied', undefined, 403);
  }

  static conflict(message: string): AnalyticsAPIError {
    return new AnalyticsAPIError('CONFLICT', message, undefined, 409);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Check if an error is an AnalyticsAPIError.
 */
export function isAnalyticsAPIError(error: unknown): error is AnalyticsAPIError {
  return error instanceof AnalyticsAPIError;
}

/**
 * Check if an error is an abort error.
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.includes('aborted');
  }
  return false;
}

/**
 * Read the display message from a route handler's error envelope.
 * Tolerates the legacy flat `{ error: 'text' }` shape so an older deploy
 * cannot make the client show nothing.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
    }
  }
  return fallback;
}