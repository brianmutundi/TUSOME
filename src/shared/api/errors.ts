/** Error normalisation shared by every feature API module. */


export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { name?: string; code?: string; message?: string; details?: string };
  if (e.name === 'AbortError') return true;
  if (e.code === 'SERVER_ERROR' && /abort/i.test(String(e.details ?? e.message ?? ''))) return true;
  return /abort/i.test(String(e.message ?? '')) && /abort/i.test(String(e.details ?? ''));
}

export function describeAnalyticsError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!error) return fallback;

  if (error instanceof Error && error.name === 'AnalyticsContractError') {
    return error.message;
  }

  const e = error as { code?: string; message?: string };
  const code = e.code;
  const message = e.message;

  if (code === 'P0001' && message) return message;
  if (code === '42501') return 'You do not have permission to view these analytics.';
  if (code === 'PGRST301' || code === '401') {
    return 'Your session has expired. Please sign in again.';
  }

  console.error('[analytics]', code ?? 'unknown', message ?? error);
  return fallback;
}
