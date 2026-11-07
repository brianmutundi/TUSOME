'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  closeParentThread,
  describeAnalyticsError,
  getParentThreadMessages,
  isAbortError,
  listParentThreads,
  markParentThreadReadStaff,
  replyParentThread,
  setParentThreadFlag,
  type InboxThread,
  type ThreadMessage,
} from '@/lib/analytics/api';
import {
  MAX_MESSAGE_LENGTH,
  audienceLabel,
  formatMessageTime,
  formatThreadTime,
  isSendableBody,
  messagesErrorMessage,
  newestMessageTime,
  previewText,
} from '@/lib/messages';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';

type Filter = 'open' | 'unread' | 'flagged' | 'closed';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'unread', label: 'Unread' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'closed', label: 'Closed' },
];

const matches = (t: InboxThread, f: Filter) =>
  f === 'open' ? t.status === 'open' : f === 'unread' ? t.isUnread : f === 'flagged' ? t.flagged : t.status === 'closed';

function Detail({
  thread,
  onChanged,
  onBack,
}: {
  thread: InboxThread;
  /** Refresh the inbox list after something changed. */
  onChanged: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    const controller = new AbortController();
    getParentThreadMessages(thread.threadId, { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setMessages(rows);
        setLoadError(null);
        const newest = newestMessageTime(rows);
        if (newest && rows.some((m) => m.senderKind === 'parent')) {
          markParentThreadReadStaff(thread.threadId, newest)
            .then(onChanged)
            .catch((caught) => console.error('markParentThreadReadStaff failed:', caught));
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        setLoadError(messagesErrorMessage(caught, 'Could not load this conversation.'));
      });
    return () => controller.abort();
    // onChanged only refreshes the list; it must not restart this load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.threadId, attempt]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !isSendableBody(reply)) return;
    setSending(true);
    setActionError(null);
    try {
      await replyParentThread(thread.threadId, reply.trim());
      setReply('');
      setAttempt((n) => n + 1);
      onChanged();
    } catch (caught) {
      setActionError(messagesErrorMessage(caught, 'Could not send the reply. Please try again.'));
      onChanged();
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!window.confirm('Close this conversation? The parent can reopen it for 14 days.')) return;
    setBusy(true);
    setActionError(null);
    try {
      await closeParentThread(thread.threadId);
      onChanged();
    } catch (caught) {
      setActionError(messagesErrorMessage(caught, 'Could not close the conversation. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleFlag = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await setParentThreadFlag(thread.threadId, !thread.flagged);
      onChanged();
    } catch (caught) {
      setActionError(messagesErrorMessage(caught, 'Could not change the flag. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const closed = thread.status === 'closed';

  return (
    <Card>
      <div className="border-b border-gray-100 px-5 py-4">
        <button type="button" onClick={onBack} className="mb-2 min-h-[2.75rem] text-sm font-medium text-blue-700 hover:underline md:hidden">
          ← Back to inbox
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-gray-900">{thread.subject}</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              {thread.parentName ?? 'Parent'}
              {thread.relationship ? ` (${thread.relationship})` : ''} about {thread.studentName}
              {thread.className ? `, ${thread.className}` : ''} · Adm {thread.admissionNo}
            </p>
            <p className="mt-1 flex flex-wrap gap-2">
              <Badge className="border-blue-200 bg-blue-50 text-blue-800">To: {audienceLabel(thread.audience)}</Badge>
              {closed && <Badge className="border-gray-200 bg-gray-100 text-gray-700">Closed</Badge>}
              {thread.flagged && <Badge className="border-amber-200 bg-amber-50 text-amber-800">Flagged</Badge>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={toggleFlag}>
              {thread.flagged ? 'Remove flag' : 'Flag'}
            </Button>
            {!closed && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={close}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        {loadError && messages === null ? (
          <Alert tone="error" title="Could not load" action={<Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}>
            {loadError}
          </Alert>
        ) : messages === null ? (
          <p className="text-sm text-gray-500" role="status">Loading conversation…</p>
        ) : (
          <ul aria-label="Conversation" className="space-y-3">
            {messages.map((m) => {
              const mine = m.senderKind === 'staff';
              return (
                <li key={m.messageId} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-gray-50 text-gray-900'}`}>
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {mine ? m.senderName ?? 'School staff' : thread.parentName ?? 'Parent'} · {formatMessageTime(m.createdAt, now)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {actionError && <Alert tone="error" title="Could not complete that">{actionError}</Alert>}

        {closed ? (
          <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            This conversation is closed. The parent can reopen it for 14 days after it was closed, or start a new message.
          </p>
        ) : (
          <form onSubmit={send} className="space-y-2">
            <label htmlFor="inbox-reply" className="block text-xs font-medium uppercase tracking-wide text-gray-500">Reply to the parent</label>
            <textarea
              id="inbox-reply"
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">{reply.length}/{MAX_MESSAGE_LENGTH}. Text only. The parent sees your name.</p>
              <Button type="submit" disabled={sending || !isSendableBody(reply)}>{sending ? 'Sending…' : 'Send reply'}</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

export default function ParentMessagesPage() {
  const [threads, setThreads] = useState<InboxThread[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listParentThreads({ signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setThreads(rows);
        setLoadError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        console.error('listParentThreads failed:', caught);
        setLoadError(describeAnalyticsError(caught, 'Could not load parent messages.'));
      });
    return () => controller.abort();
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const counts = useMemo(() => {
    const all = threads ?? [];
    return Object.fromEntries(FILTERS.map((f) => [f.id, all.filter((t) => matches(t, f.id)).length])) as Record<Filter, number>;
  }, [threads]);
  const visible = useMemo(() => (threads ?? []).filter((t) => matches(t, filter)), [threads, filter]);
  const selected = threads?.find((t) => t.threadId === selectedId) ?? null;
  const [now] = useState(() => new Date());

  if (loadError && threads === null) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load parent messages" action={<Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>}>
          {loadError}
        </Alert>
      </main>
    );
  }
  if (threads === null) return <LoadingPanel label="Loading parent messages…" />;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Parent messages
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Parent messages</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Messages from parents sent to you as a class teacher, the bursar or the school office. Replies appear in the parent app. There is no SMS.
        </p>
      </div>

      {loadError && <div className="mb-4"><Alert tone="error" title="Could not refresh">{loadError}</Alert></div>}

      <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={selected ? 'hidden md:block' : ''}>
          <Card>
            <CardHeader title="Inbox" description="Newest activity first." />
            <div role="tablist" aria-label="Filter messages" className="flex flex-wrap gap-1 border-b border-gray-100 px-3 py-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-[2.75rem] rounded-lg px-3 text-sm font-medium ${filter === f.id ? 'bg-blue-50 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {f.label} ({counts[f.id]})
                </button>
              ))}
            </div>
            {visible.length === 0 ? (
              <EmptyState
                title={threads.length === 0 ? 'No messages yet' : 'Nothing here'}
                description={threads.length === 0 ? 'Parents can write to you from the parent app.' : 'No conversations match this filter.'}
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {visible.map((t) => (
                  <li key={t.threadId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.threadId)}
                      aria-current={t.threadId === selectedId ? 'true' : undefined}
                      className={`block min-h-[4rem] w-full px-4 py-3 text-left hover:bg-gray-50 ${t.threadId === selectedId ? 'bg-blue-50' : ''}`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${t.isUnread ? 'font-bold' : 'font-medium'} text-gray-900`}>
                          {t.isUnread && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-600 align-middle" aria-label="Unread" />}
                          {t.subject}
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">{formatThreadTime(t.lastMessageAt, now)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-600">
                        {t.parentName ?? 'Parent'} · {t.studentName}{t.className ? `, ${t.className}` : ''}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-gray-600">
                        {t.lastSenderKind === 'staff' ? 'Reply sent: ' : ''}{previewText(t.lastMessagePreview)}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1 text-xs text-gray-500">
                        <span>{audienceLabel(t.audience)}</span>
                        {t.status === 'closed' && <span>· Closed</span>}
                        {t.flagged && <span className="font-semibold text-amber-700">· Flagged</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className={selected ? '' : 'hidden md:block'}>
          {selected ? (
            <Detail key={selected.threadId} thread={selected} onChanged={refresh} onBack={() => setSelectedId(null)} />
          ) : (
            <Card>
              <EmptyState title="Select a conversation" description="Choose a message on the left to read and reply." />
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
