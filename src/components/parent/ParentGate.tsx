'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Skeleton } from '@/components/ui';
import { ProfileMenu } from '@/components/shell/ProfileMenu';
import { createClient } from '@/lib/supabase/client';
import { describeAnalyticsError, getMyPermissions } from '@/lib/analytics/api';
import { roleKey } from '@/lib/analytics/accounts';

type GateState = 'loading' | 'ready' | 'error';

export function ParentGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GateState>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

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
        setRole(me.role);
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

  const signOut = async () => {
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace('/login');
    }
  };

  if (state === 'error') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Alert tone="error" title="Could not open the parent portal">
          {message}
        </Alert>
      </main>
    );
  }

  if (state === 'loading') {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10" aria-busy="true">
        <span className="sr-only">Checking your account…</span>
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/parent" className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">T</span>
            Parent portal
          </Link>
          <ProfileMenu email={email} role={role} showAdminLinks={false} onSignOut={signOut} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
