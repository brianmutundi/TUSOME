import type { ReactNode } from 'react';
import { usePermissions } from '@/lib/auth/usePermissions';

/**
 * Renders children only when the caller holds the required permission(s).
 * Fail-closed: while loading or on error, renders nothing (or `fallback`).
 */
export function Can({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
}: {
  permission?: string;
  anyOf?: readonly string[];
  allOf?: readonly string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { loading, can, canAny, canAll } = usePermissions();
  if (loading) return <>{fallback}</>;
  let allowed = true;
  if (permission) allowed = allowed && can(permission);
  if (anyOf && anyOf.length) allowed = allowed && canAny(anyOf);
  if (allOf && allOf.length) allowed = allowed && canAll(allOf);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
