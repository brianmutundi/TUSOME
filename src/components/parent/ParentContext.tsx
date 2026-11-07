'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  describeAnalyticsError,
  getEvents,
  getMyChildHomework,
  getMyChildren,
  getMyMessageOptions,
  getMyNotices,
  getMyPreferences,
  getMyThreads,
  isAbortError,
  markNoticesRead,
  setMyChildHomeworkDone,
  setMyPreferences,
  type MyChild,
  type MyChildHomework,
  type MyMessageOption,
  type MyThread,
  type ParentNotice,
  type ParentPreferences,
} from '@/lib/analytics/api';
import { homeworkErrorMessage, homeworkTodoCount, isAccessDenied } from '@/lib/homework';
import { messagesErrorMessage, unreadThreadCount } from '@/lib/messages';
import type { EventRow } from '@/lib/analytics/types';
import { upcomingEvents } from '@/lib/parent/portal';

// Only the selected child is device-local; notice read state lives on the server.
const CHILD_KEY = 'tusome.parent.child';

// Storage can be blocked (private mode, embedded views); the portal must still work.
function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

interface ParentContextValue {
  email: string | null;
  signOut: () => void;
  /** null while loading */
  kids: MyChild[] | null;
  loadError: string | null;
  child: MyChild | null;
  selectChild: (studentId: string) => void;
  notices: ParentNotice[];
  events: EventRow[];
  unreadCount: number;
  markRead: (noticeIds: string[]) => void;
  /** The selected child's homework; null while loading. Shared so the nav badge and the screen agree. */
  homework: MyChildHomework[] | null;
  homeworkError: string | null;
  reloadHomework: () => void;
  /** Homework not ticked and not yet overdue. */
  homeworkTodo: number;
  /** Optimistic tick; puts the old state back and rethrows if the save fails. */
  setHomeworkDone: (assignmentId: string, done: boolean) => Promise<void>;
  /** The parent's message threads across all children; null until the first load. */
  threads: MyThread[] | null;
  /** Set when a load failed; screens show it only while there is nothing to show. */
  threadsError: string | null;
  /** Per child: may the parent message the school, and who is the class teacher. */
  messageOptions: MyMessageOption[] | null;
  /** Re-reads threads and options in the background (the lists stay on screen). */
  reloadThreads: () => void;
  /** Threads with a staff reply not yet opened; drives the badge on the More tab. */
  messagesUnread: number;
  /** Clears one thread's unread dot at once, after the server has been told. */
  markThreadReadLocal: (threadId: string) => void;
  /** Reminder choices; null until loaded (or if loading failed: see preferencesError). */
  preferences: ParentPreferences | null;
  preferencesError: string | null;
  reloadPreferences: () => void;
  /** Optimistic save of some choices; puts the old ones back and rethrows if the save fails. */
  savePreferences: (patch: Partial<ParentPreferences>) => Promise<void>;
}

const Ctx = createContext<ParentContextValue | null>(null);

export function useParent(): ParentContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useParent must be used inside ParentProvider');
  return value;
}

export function ParentProvider({
  email,
  onSignOut,
  children,
}: {
  email: string | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [kids, setKids] = useState<MyChild[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notices, setNotices] = useState<ParentNotice[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    setSelectedId(storageGet(CHILD_KEY));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    getMyChildren(opts)
      .then(setKids)
      .catch((caught) => {
        if (isAbortError(caught)) return;
        console.error('getMyChildren failed:', caught);
        setLoadError(describeAnalyticsError(caught, 'Could not load your children.'));
      });
    // School notices and events are secondary: a failure leaves them empty rather than blocking the portal.
    // The server already limits this to published, unexpired notices for parents.
    getMyNotices(opts)
      .then(setNotices)
      .catch((caught) => !isAbortError(caught) && console.error('getMyNotices failed:', caught));
    getEvents(undefined, undefined, opts)
      .then((rows) => setEvents(upcomingEvents(rows)))
      .catch((caught) => !isAbortError(caught) && console.error('getEvents failed:', caught));
    return () => controller.abort();
  }, []);

  const child = useMemo(() => {
    if (!kids || kids.length === 0) return null;
    return kids.find((k) => k.studentId === selectedId) ?? kids.find((k) => k.isPrimary) ?? kids[0];
  }, [kids, selectedId]);

  const childId = child?.studentId ?? null;
  const [homework, setHomework] = useState<MyChildHomework[] | null>(null);
  const [homeworkError, setHomeworkError] = useState<string | null>(null);
  const [homeworkAttempt, setHomeworkAttempt] = useState(0);

  useEffect(() => {
    setHomework(null);
    setHomeworkError(null);
    if (!childId) return;
    const controller = new AbortController();
    getMyChildHomework(childId, { signal: controller.signal })
      .then((rows) => !controller.signal.aborted && setHomework(rows))
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        console.error('getMyChildHomework failed:', caught);
        setHomeworkError(
          isAccessDenied(caught)
            ? 'The school has not shared homework for this child with your account.'
            : homeworkErrorMessage(caught, 'Could not load homework.')
        );
      });
    return () => controller.abort();
  }, [childId, homeworkAttempt]);

  const reloadHomework = useCallback(() => setHomeworkAttempt((n) => n + 1), []);

  const setHomeworkDone = useCallback(
    async (assignmentId: string, done: boolean) => {
      if (!childId) return;
      const flip = (value: boolean) =>
        setHomework((prev) =>
          prev && prev.map((h) => (h.assignmentId === assignmentId ? { ...h, isDone: value, doneAt: value ? new Date().toISOString() : null } : h))
        );
      flip(done);
      try {
        await setMyChildHomeworkDone(assignmentId, childId, done);
      } catch (caught) {
        flip(!done);
        throw caught;
      }
    },
    [childId]
  );

  const homeworkTodo = useMemo(() => homeworkTodoCount(homework), [homework]);

  const [threads, setThreads] = useState<MyThread[] | null>(null);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [messageOptions, setMessageOptions] = useState<MyMessageOption[] | null>(null);
  const [threadsAttempt, setThreadsAttempt] = useState(0);
  const threadsLoadedAt = useRef(0);

  // Messages belong to the parent, not to the selected child. Reloads keep what is on screen.
  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    getMyThreads(opts)
      .then((rows) => {
        if (controller.signal.aborted) return;
        threadsLoadedAt.current = Date.now();
        setThreads(rows);
        setThreadsError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        console.error('getMyThreads failed:', caught);
        setThreadsError(messagesErrorMessage(caught, 'Could not load your messages.'));
      });
    getMyMessageOptions(opts)
      .then((rows) => !controller.signal.aborted && setMessageOptions(rows))
      .catch((caught) => !isAbortError(caught) && console.error('getMyMessageOptions failed:', caught));
    return () => controller.abort();
  }, [threadsAttempt]);

  const reloadThreads = useCallback(() => setThreadsAttempt((n) => n + 1), []);

  // In-app badge only: refresh when the parent returns to the app after a while away.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - threadsLoadedAt.current > 30_000) {
        setThreadsAttempt((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const markThreadReadLocal = useCallback((threadId: string) => {
    setThreads((prev) => prev && prev.map((t) => (t.threadId === threadId && t.isUnread ? { ...t, isUnread: false } : t)));
  }, []);

  const [preferences, setPreferences] = useState<ParentPreferences | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesAttempt, setPreferencesAttempt] = useState(0);
  const preferencesRef = useRef<ParentPreferences | null>(null);
  preferencesRef.current = preferences;

  useEffect(() => {
    const controller = new AbortController();
    getMyPreferences({ signal: controller.signal })
      .then((p) => {
        if (controller.signal.aborted) return;
        setPreferences(p);
        setPreferencesError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        console.error('getMyPreferences failed:', caught);
        setPreferencesError(describeAnalyticsError(caught, 'Could not load your reminder settings.'));
      });
    return () => controller.abort();
  }, [preferencesAttempt]);

  const reloadPreferences = useCallback(() => setPreferencesAttempt((n) => n + 1), []);

  const savePreferences = useCallback(async (patch: Partial<ParentPreferences>) => {
    const before = preferencesRef.current;
    if (!before) return;
    const next = { ...before, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    try {
      await setMyPreferences(next);
    } catch (caught) {
      // Undo only this change, so a later toggle that already succeeded is kept.
      const undo = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof ParentPreferences]]));
      const reverted = { ...(preferencesRef.current ?? before), ...undo };
      preferencesRef.current = reverted;
      setPreferences(reverted);
      throw caught;
    }
  }, []);

  // With in-app reply notifications switched off the counts disappear; the lists still mark new replies.
  const messagesUnread = useMemo(
    () => (preferences?.replyNotifications === false ? 0 : unreadThreadCount(threads)),
    [threads, preferences]
  );

  const selectChild = useCallback((studentId: string) => {
    setSelectedId(studentId);
    storageSet(CHILD_KEY, studentId);
  }, []);

  // Optimistic: flip the flag now, tell the server, and put it back if the save fails.
  const markRead = useCallback((ids: string[]) => {
    const wanted = new Set(ids);
    const changed = notices.filter((n) => wanted.has(n.noticeId) && !n.isRead).map((n) => n.noticeId);
    if (changed.length === 0) return;
    const flip = (value: boolean) => {
      const touched = new Set(changed);
      setNotices((prev) => prev.map((n) => (touched.has(n.noticeId) ? { ...n, isRead: value } : n)));
    };
    flip(true);
    markNoticesRead(changed).catch((caught) => {
      if (isAbortError(caught)) return;
      console.error('markNoticesRead failed:', caught);
      flip(false);
    });
  }, [notices]);

  const value = useMemo<ParentContextValue>(
    () => ({
      email,
      signOut: onSignOut,
      kids,
      loadError,
      child,
      selectChild,
      notices,
      events,
      unreadCount: notices.filter((n) => !n.isRead).length,
      markRead,
      homework,
      homeworkError,
      reloadHomework,
      homeworkTodo,
      setHomeworkDone,
      threads,
      threadsError,
      messageOptions,
      reloadThreads,
      messagesUnread,
      markThreadReadLocal,
      preferences,
      preferencesError,
      reloadPreferences,
      savePreferences,
    }),
    [
      email, onSignOut, kids, loadError, child, selectChild, notices, events, markRead,
      homework, homeworkError, reloadHomework, homeworkTodo, setHomeworkDone,
      threads, threadsError, messageOptions, reloadThreads, messagesUnread, markThreadReadLocal,
      preferences, preferencesError, reloadPreferences, savePreferences,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
