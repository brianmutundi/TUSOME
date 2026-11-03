import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { roleKey } from '@/lib/analytics/accounts';
import { authenticate } from '@/lib/server/auth';
import { getSupabaseBrowserConfig } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Body {
  schoolName?: string;
  ownerName?: string;
  ownerEmail?: string;
  password?: string;
}

/** Platform super admins only: create a school, its owner login and owner profile. */
export async function POST(request: NextRequest) {
  const caller = await authenticate(request);
  if (!caller) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const schoolName = (body.schoolName ?? '').trim();
  const ownerName = (body.ownerName ?? '').trim();
  const ownerEmail = (body.ownerEmail ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!schoolName) return NextResponse.json({ error: 'School name is required' }, { status: 400 });
  if (!EMAIL_RE.test(ownerEmail)) {
    return NextResponse.json({ error: 'Enter a valid owner email' }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const { url, key } = getSupabaseBrowserConfig();
  const asCaller = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${caller.accessToken}` } },
  });

  // Check the caller before any account is created.
  const { data: me, error: meError } = await asCaller.rpc('get_my_permissions');
  if (meError || roleKey((me as { role?: string } | null)?.role) !== 'super admin') {
    return NextResponse.json(
      { error: 'Only a platform super admin can add schools.' },
      { status: 403 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const created = password
    ? await admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true })
    : await admin.auth.admin.inviteUserByEmail(ownerEmail);
  if (created.error || !created.data.user) {
    const message = created.error?.message ?? 'Could not create the owner login.';
    const exists = /already|registered|exists/i.test(message);
    return NextResponse.json(
      { error: exists ? 'That email already has a login. Use a different owner email.' : message },
      { status: exists ? 409 : 400 }
    );
  }
  const ownerId = created.data.user.id;

  const { data: tenantId, error: rpcError } = await asCaller.rpc('platform_create_school', {
    p_name: schoolName,
    p_owner_user_id: ownerId,
    p_owner_name: ownerName || null,
  });
  if (rpcError) {
    await admin.auth.admin.deleteUser(ownerId); // undo the login we just made
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  return NextResponse.json({
    tenantId,
    ownerEmail,
    invited: !password,
  });
}

export async function DELETE(request: NextRequest) {
  const caller = await authenticate(request);
  if (!caller) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' }, { status: 500 });
  }

  let body: { tenantId?: string };
  try {
    body = (await request.json()) as { tenantId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const tenantId = (body.tenantId ?? '').trim();
  if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

  const { url, key } = getSupabaseBrowserConfig();
  const asCaller = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${caller.accessToken}` } },
  });

  const { data: me, error: meError } = await asCaller.rpc('get_my_permissions');
  if (meError || roleKey((me as { role?: string } | null)?.role) !== 'super admin') {
    return NextResponse.json({ error: 'Only a platform super admin can delete schools.' }, { status: 403 });
  }

  const { data: ownerId, error: rpcError } = await asCaller.rpc('delete_school', { p_tenant_id: tenantId });
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (ownerId) {
    await admin.auth.admin.deleteUser(String(ownerId)).catch(() => {});
  }

  return NextResponse.json({ deleted: true });
}
