'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Skeleton } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { describeAnalyticsError, getMyPermissions } from '@/lib/analytics/api';
import { roleKey } from '@/lib/analytics/accounts';
import { ParentProvider } from './ParentContext';
import { BottomNav } from './parts';

type GateState = 'loading' | 'ready' | 'error';

export function ParentGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GateState>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();

    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();
        if (disposed) return;
        if (error) throw error;
        if (!data.session) {
          router.replace(`/login?next=${encodeURIComponent(pathname || '/parent')}`);
          return;
        }
        const me = await getMyPermissions({ signal: controller.signal });
        if (disposed) return;
        setEmail(data.session.user.email ?? null);
        if (roleKey(me.role) !== 'parent') {
          router.replace('/analytics');
          return;
        }
        setState('ready');
      } catch (caught) {
        if (disposed) return;
        setMessage(describeAnalyticsError(caught, 'Could not check your account.'));
        setState('error');
      }
    })();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [pathname, router]);

  const signOut = useCallback(async () => {
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace('/login');
    }
  }, [router]);

  if (state === 'error') {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <Alert tone="error" title="Could not open the parent portal">
          {message}
        </Alert>
      </main>
    );
  }

  if (state === 'loading') {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-5 py-10" aria-busy="true">
        <span className="sr-only">Checking your account…</span>
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </main>
    );
  }

  return (
    <ParentProvider email={email} onSignOut={signOut}>
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-lg pb-28">{children}</main>
        <BottomNav />
      </div>
    </ParentProvider>
  );
}
