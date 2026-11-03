/**
 * Standardized RPC caller with consistent error handling.
 *
 * All API functions should use this helper to ensure uniform
 * error handling, abort signal management, and contract validation.
 */

import { createClient } from '@/lib/supabase/client';
import { AnalyticsAPIError } from './errors';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RpcOptions {
  signal?: AbortSignal;
}

/**
 * Call a Supabase RPC with consistent error handling.
 *
 * @param rpcName - The RPC function name
 * @param params - Parameters to pass to the RPC
 * @param options - Request options (signal for abort)
 * @returns The data returned by the RPC
 * @throws AnalyticsAPIError on failure
 */
export async function callRpc<T>(
  rpcName: string,
  params: Record<string, unknown> = {},
  options: RpcOptions = {}
): Promise<T> {
  const supabase = createClient();
  const controller = new AbortController();
  const signal = options.signal ?? controller.signal;

  try {
    const { data, error } = await supabase
      .rpc(rpcName, params)
      .abortSignal(signal);

    if (error) {
      throw AnalyticsAPIError.fromSupabaseError(error);
    }

    return data as T;
  } catch (error) {
    if (error instanceof AnalyticsAPIError) throw error;
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
      throw new AnalyticsAPIError('ABORTED', 'Request was aborted');
    }
    throw new AnalyticsAPIError('SERVER_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Validate input at the API boundary before calling RPC.
 * Throws AnalyticsAPIError on validation failure.
 */
export function validateInput<T>(
  value: T,
  validator: (v: T) => void
): T {
  try {
    validator(value);
    return value;
  } catch (error) {
    if (error instanceof AnalyticsAPIError) throw error;
    throw AnalyticsAPIError.validation(error instanceof Error ? error.message : 'Validation failed');
  }
}