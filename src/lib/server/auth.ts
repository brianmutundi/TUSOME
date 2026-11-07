import type { NextRequest } from 'next/server';
import { createClient, type Session } from '@supabase/supabase-js';
import { getSupabaseBrowserConfig } from '@/lib/supabase/client';

export interface Caller {
  accessToken: string;
  session: Session;
}

export async function getCallerPermissions(caller: Caller): Promise<string[]> {
  const { url, key } = getSupabaseBrowserConfig();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${caller.accessToken}` } },
  });
  const { data, error } = await supabase.rpc('get_my_permissions');
  if (error || !data) return [];
  const row = data as Record<string, unknown>;
  const perms = Array.isArray(row.permissions) ? row.permissions.map(String) : [];
  return perms;
}

export function hasAnyPermission(perms: string[], codes: readonly string[]): boolean {
  const set = new Set(perms);
  return codes.some((c) => set.has(c));
}

function decodeExp(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

/** Verify the caller's Supabase access token. Returns null when it is missing or invalid. */
export async function authenticate(request: NextRequest): Promise<Caller | null> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const accessToken = match[1].trim();

  const { url, key } = getSupabaseBrowserConfig();
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const expiresAt = decodeExp(accessToken);
  const session = {
    access_token: accessToken,
    refresh_token: '',
    token_type: 'bearer',
    expires_at: expiresAt,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    user: data.user,
  } as Session;
  return { accessToken, session };
}

