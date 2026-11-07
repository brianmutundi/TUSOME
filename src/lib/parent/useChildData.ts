'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { describeAnalyticsError, isAbortError } from '@/lib/analytics/api';

type Loader<T> = (studentId: string, options: { signal: AbortSignal }) => Promise<T>;

/** Loads one child-scoped resource; refetches when the child changes. */
export function useChildData<T>(studentId: string, load: Loader<T>, errorMessage: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    loadRef
      .current(studentId, { signal: controller.signal })
      .then(setData)
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        console.error(errorMessage, caught);
        setError(describeAnalyticsError(caught, errorMessage));
      });
    return () => controller.abort();
  }, [studentId, attempt, errorMessage]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, retry };
}
