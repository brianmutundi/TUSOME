import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export interface SupabaseBrowserConfig {
  url: string;
  key: string;
}

/**
 * Read the browser-visible Supabase configuration.
 *
 * Only `NEXT_PUBLIC_*` variables are inlined into the client bundle, so the
 * server-only names (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) must not be
 * relied on here. Throwing a readable error is better than constructing a
 * client against `undefined`, which fails later with an opaque fetch error.
 */
export function getSupabaseBrowserConfig(): SupabaseBrowserConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).'
    );
  }

  // Local development is opt-in and loopback-only. This prevents a stale or
  // copied .env.local from silently sending synthetic/local credentials to a
  // hosted project, and makes an accidental production switch fail loudly.
  if (process.env.NEXT_PUBLIC_LOCAL_BACKEND === '1') {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL');
    }
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
      throw new Error(
        `NEXT_PUBLIC_LOCAL_BACKEND=1 but NEXT_PUBLIC_SUPABASE_URL points at "${host}". ` +
          'Local mode only permits loopback hosts.'
      );
    }
  }

  return { url, key };
}

/**
 * One browser client per tab. Creating a client per call would spin up extra
 * auth listeners and refresh timers, so every hook shares this instance.
 */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const { url, key } = getSupabaseBrowserConfig();
  browserClient = createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: { 'x-application-name': 'tusome-analytics' },
    },
  });
  return browserClient;
}

/** Test-only hook; do not call from application code. */
export function __resetSupabaseClientForTests() {
  browserClient = null;
}
