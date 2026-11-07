/** Request primitives shared by every feature API module. */

import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';

export interface RequestOptions {
  signal?: AbortSignal;
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
}

export async function parentRpc<T>(
  fn: string,
  args: Record<string, unknown> | undefined,
  options: RequestOptions
): Promise<T[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc(fn, args)
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []) as T[];
}
