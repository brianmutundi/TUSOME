import type { MyPermissions } from '@/lib/analytics/api';
import { roleKey } from '@/lib/analytics/accounts';

/**
 * Central, fail-closed permission helpers.
 *
 * UI gating only — the server (RPCs + RLS) is the real enforcement.
 * Every helper returns false on null/undefined/missing data.
 */

export function isPlatformSuperAdmin(session: { user?: { app_metadata?: Record<string, unknown> } } | null | undefined): boolean {
  const meta = (session?.user?.app_metadata ?? {}) as Record<string, unknown>;
  return meta.is_platform_owner === true || meta.role === 'platform_owner';
}

export function isActiveAccount(me: MyPermissions | null | undefined): boolean {
  // The RPC (get_my_permissions) already returns an empty permission set for
  // revoked/inactive accounts, so a non-null result implies an active account.
  // Client-side we cannot read is_active/access_revoked (not in the payload).
  return me != null;
}

export function hasPermission(me: MyPermissions | null | undefined, code: string): boolean {
  if (!isActiveAccount(me)) return false;
  const perms = me?.permissions ?? [];
  return Array.isArray(perms) && perms.includes(code);
}

export function hasAny(me: MyPermissions | null | undefined, codes: readonly string[]): boolean {
  if (!isActiveAccount(me)) return false;
  return codes.some((c) => hasPermission(me, c));
}

export function hasAll(me: MyPermissions | null | undefined, codes: readonly string[]): boolean {
  if (!isActiveAccount(me)) return false;
  return codes.every((c) => hasPermission(me, c));
}

export function isSchoolAdmin(me: MyPermissions | null | undefined): boolean {
  if (!isActiveAccount(me)) return false;
  const k = roleKey(me?.role);
  return k === 'admin' || k === 'principal' || k === 'director';
}

export function effectivePermissions(me: MyPermissions | null | undefined): string[] {
  if (!isActiveAccount(me)) return [];
  const perms = me?.permissions;
  return Array.isArray(perms) ? perms : [];
}

/**
 * Fail-closed loader wrapper: returns null on any error or inactive account.
 * Callers must treat null as "deny everything".
 */
export async function loadMyPermissionsSafe(
  loader: () => Promise<MyPermissions>
): Promise<MyPermissions | null> {
  try {
    const me = await loader();
    if (!isActiveAccount(me)) return null;
    return me;
  } catch {
    return null;
  }
}
