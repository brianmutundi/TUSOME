import { useCallback, useEffect, useState } from 'react';
import { getMyPermissions, type MyPermissions } from '@/lib/analytics/api';
import { hasPermission, hasAny, hasAll, loadMyPermissionsSafe } from '@/lib/auth/permissions';

export interface PermissionState {
  me: MyPermissions | null;
  loading: boolean;
  error: boolean;
  can: (code: string) => boolean;
  canAny: (codes: readonly string[]) => boolean;
  canAll: (codes: readonly string[]) => boolean;
  isSuperAdmin: boolean;
  reload: () => void;
}

/**
 * Central, fail-closed permission hook for pages.
 * Returns loading=true until the first load resolves; on failure, can* return false.
 */
export function usePermissions(): PermissionState {
  const [me, setMe] = useState<MyPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    loadMyPermissionsSafe(() => getMyPermissions())
      .then((result) => {
        if (disposed) return;
        setMe(result);
        setError(result === null);
        setLoading(false);
      })
      .catch(() => {
        if (disposed) return;
        setMe(null);
        setError(true);
        setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [tick]);

  const can = useCallback((code: string) => hasPermission(me, code), [me]);
  const canAnyCb = useCallback((codes: readonly string[]) => hasAny(me, codes), [me]);
  const canAllCb = useCallback((codes: readonly string[]) => hasAll(me, codes), [me]);

  return {
    me,
    loading,
    error,
    can,
    canAny: canAnyCb,
    canAll: canAllCb,
    isSuperAdmin: me?.role === 'super admin',
    reload: () => setTick((t) => t + 1),
  };
}
