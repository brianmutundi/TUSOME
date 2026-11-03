'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, EmptyState } from '@/components/ui';
import { describeAnalyticsError, isAbortError } from '@/lib/analytics/api';

export function useSection<T>(
  load: (signal: AbortSignal) => Promise<T>,
  fallback: string,
  deps: ReadonlyArray<unknown> = []
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    load(controller.signal)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        setError(describeAnalyticsError(caught, fallback));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...deps]);

  const reload = useCallback(() => setToken((v) => v + 1), []);
  return { data, error, loading, reload };
}

export function SectionBody<T>({
  state,
  children,
  empty,
}: {
  state: { data: T[] | null; error: string | null; loading: boolean; reload: () => void };
  children: (rows: T[]) => ReactNode;
  empty: { title: string; description: string };
}) {
  if (state.loading && !state.data) {
    return <p className="px-5 py-6 text-sm text-gray-500">Loading…</p>;
  }
  if (state.error) {
    return (
      <div className="p-5">
        <Alert
          tone="error"
          title="Could not load this section"
          action={
            <Button variant="danger" size="sm" onClick={state.reload}>
              Retry
            </Button>
          }
        >
          {state.error}
        </Alert>
      </div>
    );
  }
  const rows = state.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="p-5">
        <EmptyState title={empty.title} />
      </div>
    );
  }
  return <>{children(rows)}</>;
}
