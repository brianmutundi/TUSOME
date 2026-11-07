'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Skeleton } from '@/components/ui';
import { AppShell } from '@/components/shell/AppShell';
import { createClient } from '@/lib/supabase/client';
import { describeAnalyticsError, getMyPermissions } from '@/lib/analytics/api';
import { canAccessRoute } from '@/lib/analytics/routePermissions';
import type { MyPermissions } from '@/lib/analytics/api';
import { roleKey } from '@/lib/analytics/accounts';
import { isActiveAccount } from '@/lib/auth/permissions';
import type { Session } from '@supabase/supabase-js';

type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'misconfigured';

function isPlatformOwnerSession(session: Session | null): boolean {
  const meta = (session?.user.app_metadata ?? {}) as Record<string, unknown>;
  return meta.is_platform_owner === true || meta.role === 'platform_owner';
}

function loginHref(pathname: string): string {
  const next = pathname && pathname.startsWith('/') ? pathname : '/analytics';
  return `/login?next=${encodeURIComponent(next)}`;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [me, setMe] = useState<MyPermissions | null>(null);
  const [subBlocked, setSubBlocked] = useState<string | null>(null);
  const [subReady, setSubReady] = useState(false);
  const [permError, setPermError] = useState(false);

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch (error) {
      setConfigError(
        describeAnalyticsError(error, 'Supabase is not configured for this deployment.')
      );
      setState('misconfigured');
      return;
    }

    let disposed = false;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (disposed) return;
        if (error) {
          setConfigError(describeAnalyticsError(error, 'Could not check your session.'));
          setState('misconfigured');
          return;
        }
        setSession(data.session);
        if (data.session) {
          if (isPlatformOwnerSession(data.session) && pathname !== '/analytics/schools') {
            router.replace('/analytics/schools');
            return;
          }
          setState('authenticated');
        } else {
          setState('anonymous');
          router.replace(loginHref(pathname));
        }
      })
      .catch((error) => {
        if (disposed) return;
        setConfigError(describeAnalyticsError(error, 'Could not check your session.'));
        setState('misconfigured');
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (disposed) return;
      setSession(nextSession);
      if (nextSession) {
        if (isPlatformOwnerSession(nextSession) && pathname !== '/analytics/schools') {
          router.replace('/analytics/schools');
          return;
        }
        setState('authenticated');
        return;
      }
      setState('anonymous');
      if (event === 'SIGNED_OUT') router.replace(loginHref(pathname));
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Parents have their own area. Send them there if they open a staff page.
  // A failed role lookup leaves the page as it is.
  useEffect(() => {
    if (state !== 'authenticated') return;
    const controller = new AbortController();
    getMyPermissions({ signal: controller.signal })
      .then(async (permissions) => {
        setPermError(false);
        if (!isActiveAccount(permissions)) {
          setPermError(true);
          return;
        }
        setMe(permissions);
        if (roleKey(permissions.role) === 'parent') router.replace('/parent');
        if (roleKey(permissions.role) === 'super admin' && pathname !== '/analytics/schools') {
          router.replace('/analytics/schools');
        }
        // Route guard: redirect if user lacks permission for this page.
        if (
          roleKey(permissions.role) !== 'super admin' &&
          !canAccessRoute(permissions.permissions, pathname)
        ) {
          router.replace('/analytics');
        }
        // Subscription gate for school users (platform super admins bypass).
        if (roleKey(permissions.role) !== 'super admin') {
          try {
            const { data } = await createClient()
              .from('tenants')
              .select('subscription_status, subscription_expires_at')
              .limit(1)
              .maybeSingle();
            const status = (data?.subscription_status ?? 'active') as string;
            const expires = data?.subscription_expires_at ? new Date(data.subscription_expires_at) : null;
            if (status !== 'active' && status !== 'trial') {
              setSubBlocked(`Your school subscription is ${status}. Contact your administrator.`);
            } else if (expires && expires.getTime() < Date.now()) {
              setSubBlocked('Your school subscription has expired. Contact your administrator.');
            } else {
              setSubBlocked(null);
            }
          } catch {
            setSubBlocked(null);
          }
        } else {
          setSubBlocked(null);
        }
        setSubReady(true);
      })
      .catch(() => {
        setPermError(true);
      });
    return () => controller.abort();
  }, [state, router, pathname]);

  const signOut = async () => {
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace('/login');
    }
  };

  if (state === 'misconfigured') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert tone="error" title="Supabase is not configured">
          {configError} Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>, then
          rebuild. See <code>.env.example</code>.
        </Alert>
      </main>
    );
  }

  if (state === 'authenticated' && !subReady) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true">
        <Skeleton className="h-8 w-56" />
      </main>
    );
  }

  if (subBlocked) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert tone="error" title="Subscription required">
          {subBlocked}
        </Alert>
        <div className="mt-4">
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (permError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert tone="error" title="Could not verify your permissions">
          We could not load your account permissions. Access is denied until this is resolved.
        </Alert>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (state === 'loading' || state === 'anonymous') {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true">
        <span className="sr-only">
          {state === 'loading' ? 'Checking your session…' : 'Redirecting to sign in…'}
        </span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-4 w-72" />
        <Skeleton className="mt-8 h-20 w-full" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </main>
    );
  }

  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    typeof meta.full_name === 'string'
      ? meta.full_name
      : typeof meta.name === 'string'
        ? meta.name
        : null;

  return (
    <AppShell
      email={session?.user.email}
      fullName={fullName}
      role={me?.role}
      isAdmin={me?.isAdmin}
      permissions={me?.permissions}
      onSignOut={signOut}
    >
      {children}
    </AppShell>
  );
}
