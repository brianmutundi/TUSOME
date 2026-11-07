import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { roleKey } from '@/lib/analytics/accounts';
import { authenticate } from '@/lib/server/auth';
import { apiError, apiErrorFromSupabase } from '@/lib/server/apiError';
import { getSupabaseBrowserConfig } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Body {
  schoolName?: string;
  ownerName?: string;
  ownerEmail?: string;
  password?: string;
}

function deriveKey(...parts: string[]): string {
  const hex = crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Platform super admins only: create a school, its owner login and owner profile. */
export async function POST(request: NextRequest) {
  const caller = await authenticate(request);
  if (!caller) return apiError('NOT_AUTHENTICATED', 'Sign in required.');

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[api/schools] SUPABASE_SERVICE_ROLE_KEY is not set');
    return apiError('SERVER_ERROR', 'School accounts are not configured on the server.');
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', { status: 400 });
  }
  const schoolName = (body.schoolName ?? '').trim();
  const ownerName = (body.ownerName ?? '').trim();
  const ownerEmail = (body.ownerEmail ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!schoolName) return apiError('VALIDATION_ERROR', 'School name is required.');
  if (!EMAIL_RE.test(ownerEmail)) return apiError('VALIDATION_ERROR', 'Enter a valid owner email.');
  if (password && password.length < 8) {
    return apiError('VALIDATION_ERROR', 'Password must be at least 8 characters.');
  }

  const { url, key } = getSupabaseBrowserConfig();
  const asCaller = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${caller.accessToken}` } },
  });

  const { data: me, error: meError } = await asCaller.rpc('get_my_permissions');
  if (meError || roleKey((me as { role?: string } | null)?.role) !== 'super admin') {
    return apiError('ACCESS_DENIED', 'Only a platform super admin can add schools.');
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Idempotency claim: derived from the intent, stable across retries. ---
  const idempotencyKey = deriveKey(caller.session.user.id, schoolName, ownerEmail);
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ schoolName, ownerName, ownerEmail, hasPassword: Boolean(password) }))
    .digest('hex');

  const claimPayload = {
    key: idempotencyKey,
    scope: 'school:create',
    request_hash: requestHash,
    state: 'in_progress',
  };

  const { error: claimErr } = await admin.from('api_idempotency_keys').insert(claimPayload);
  if (claimErr) {
    // Unique violation (or any insert failure): look up the existing claim.
    const { data: existing } = await admin
      .from('api_idempotency_keys')
      .select('request_hash, state, response')
      .eq('key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      if (existing.request_hash !== requestHash) {
        return apiError('CONFLICT', 'This request was already made with different details.');
      }
      if (existing.state === 'done' && existing.response) {
        return NextResponse.json(existing.response);
      }
      if (existing.state === 'in_progress') {
        return apiError('CONFLICT', 'School creation is already in progress. Try again in a moment.');
      }
      // 'failed' state: clear and retry the claim.
      await admin.from('api_idempotency_keys').delete().eq('key', idempotencyKey);
      const { error: retryErr } = await admin.from('api_idempotency_keys').insert(claimPayload);
      if (retryErr) {
        return apiError('CONFLICT', 'School creation is already in progress. Try again in a moment.');
      }
    } else {
      return apiError('SERVER_ERROR', 'Could not record the request. Try again.');
    }
  }

  // --- Create the owner login and the school. ---
  try {
    const created = password
      ? await admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true })
      : await admin.auth.admin.inviteUserByEmail(ownerEmail);
    if (created.error || !created.data.user) {
      const message = created.error?.message ?? 'Could not create the owner login.';
      const exists = /already|registered|exists/i.test(message);
      await admin.from('api_idempotency_keys').update({ state: 'failed' }).eq('key', idempotencyKey);
      return apiError(exists ? 'CONFLICT' : 'VALIDATION_ERROR', exists ? 'That email already has a login. Use a different owner email.' : 'Could not create the owner login.');
    }
    const ownerId = created.data.user.id;

    const { data: tenantId, error: rpcError } = await asCaller.rpc('platform_create_school', {
      p_name: schoolName,
      p_owner_user_id: ownerId,
      p_owner_name: ownerName || null,
    });
    if (rpcError) {
      await admin.auth.admin.deleteUser(ownerId).catch(() => {});
      await admin.from('api_idempotency_keys').update({ state: 'failed' }).eq('key', idempotencyKey);
      return apiErrorFromSupabase(rpcError, { exposeServerMessage: true });
    }

    const response = { tenantId, ownerEmail, invited: !password };
    await admin.from('api_idempotency_keys').update({ state: 'done', resource_id: tenantId, response }).eq('key', idempotencyKey);
    return NextResponse.json(response);
  } catch (caught) {
    console.error('[api/schools] unexpected failure', caught);
    await admin.from('api_idempotency_keys').update({ state: 'failed' }).eq('key', idempotencyKey);
    return apiError('SERVER_ERROR', 'Could not add the school.');
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await authenticate(request);
  if (!caller) return apiError('NOT_AUTHENTICATED', 'Sign in required.');

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[api/schools] SUPABASE_SERVICE_ROLE_KEY is not set');
    return apiError('SERVER_ERROR', 'School accounts are not configured on the server.');
  }

  let body: { tenantId?: string };
  try {
    body = (await request.json()) as { tenantId?: string };
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', { status: 400 });
  }
  const tenantId = (body.tenantId ?? '').trim();
  if (!tenantId) return apiError('VALIDATION_ERROR', 'tenantId is required.');

  const { url, key } = getSupabaseBrowserConfig();
  const asCaller = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${caller.accessToken}` } },
  });

  const { data: me, error: meError } = await asCaller.rpc('get_my_permissions');
  if (meError || roleKey((me as { role?: string } | null)?.role) !== 'super admin') {
    return apiError('ACCESS_DENIED', 'Only a platform super admin can delete schools.');
  }

  const { data: ownerId, error: rpcError } = await asCaller.rpc('delete_school', { p_tenant_id: tenantId });
  if (rpcError) {
    return apiErrorFromSupabase(rpcError, { exposeServerMessage: true });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (ownerId) {
    await admin.auth.admin.deleteUser(String(ownerId)).catch(() => {});
  }

  return NextResponse.json({ deleted: true });
}
