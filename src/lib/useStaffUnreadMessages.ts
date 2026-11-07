'use client';

import { useEffect, useState } from 'react';
import { isAbortError, listParentThreads } from '@/lib/analytics/api';

export const STAFF_UNREAD_POLL_MS = 60_000;

/**
 * How many parent-message threads the signed-in staff member can see that have a parent message
 * nobody has opened yet. Reloads on mount, when `refreshKey` changes (the shell passes the
 * pathname, so opening a thread and coming back updates it), every minute, and when the tab
 * regains focus. A failed reload keeps the last count; the badge is secondary and must never
 * block the shell. With `enabled` false it makes no request and reports 0.
 */
export function useStaffUnreadMessages(enabled: boolean, refreshKey: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      listParentThreads({ signal: current.signal })
        .then((rows) => {
          if (!current.signal.aborted) setCount(rows.filter((t) => t.isUnread).length);
        })
        .catch((caught) => {
          if (current.signal.aborted || isAbortError(caught)) return;
          console.error('listParentThreads (unread badge) failed:', caught);
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    load();
    const timer = window.setInterval(load, STAFF_UNREAD_POLL_MS);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refreshKey]);

  return count;
}
