'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  getMyThreadMessages,
  isAbortError,
  markMyThreadRead,
  reopenMyThread,
  sendMyThreadMessage,
  type MyThread,
  type ThreadMessage,
} from '@/lib/analytics/api';
import { useParent } from '@/components/parent/ParentContext';
import { LoadFailure, ScreenSkeleton, TopBar, cardClass } from '@/components/parent/parts';
import {
  MAX_MESSAGE_LENGTH,
  audienceLabel,
  formatMessageTime,
  isSendableBody,
  messagesErrorMessage,
  newestMessageTime,
} from '@/lib/messages';
import { firstName } from '@/lib/parent/portal';

function Bubble({ message, thread, now }: { message: ThreadMessage; thread: MyThread; now: Date }) {
  const mine = message.senderKind === 'parent';
  const who = mine ? 'You' : message.senderName ?? audienceLabel(thread.audience);
  return (
    <li className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-gray-100 bg-white text-gray-900 shadow-sm'}`}
      >
        <p className="whitespace-pre-line break-words">{message.body}</p>
      </div>
      <p className="mt-1 px-1 text-xs text-gray-500">
        <span className="sr-only">From </span>
        {who} · {formatMessageTime(message.createdAt, now)}
      </p>
    </li>
  );
}

function ThreadView({ thread, threadId }: { thread: MyThread; threadId: string }) {
  const { reloadThreads, markThreadReadLocal } = useParent();
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const endRef = useRef<HTMLDivElement>(null);

  // Reloads (after a send) keep the conversation on screen; only the first load shows a skeleton.
  useEffect(() => {
    const controller = new AbortController();
    getMyThreadMessages(threadId, { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setMessages(rows);
        setLoadError(null);
        const newest = newestMessageTime(rows);
        if (newest && rows.some((m) => m.senderKind === 'staff')) {
          markMyThreadRead(threadId, newest)
            .then(() => markThreadReadLocal(threadId))
            .catch((caught) => console.error('markMyThreadRead failed:', caught));
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        console.error('getMyThreadMessages failed:', caught);
        setLoadError(messagesErrorMessage(caught, 'Could not load this conversation.'));
      });
    return () => controller.abort();
  }, [threadId, attempt, markThreadReadLocal]);

  useEffect(() => {
    if (messages) endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !isSendableBody(reply)) return;
    setSending(true);
    setActionError(null);
    try {
      await sendMyThreadMessage(threadId, reply.trim());
      setReply('');
      setAttempt((n) => n + 1);
      reloadThreads();
    } catch (caught) {
      console.error('sendMyThreadMessage failed:', caught);
      setActionError(messagesErrorMessage(caught, 'Could not send your message. Check your connection and try again.'));
      reloadThreads();
    } finally {
      setSending(false);
    }
  };

  const reopen = async () => {
    setReopening(true);
    setActionError(null);
    try {
      await reopenMyThread(threadId);
      reloadThreads();
    } catch (caught) {
      console.error('reopenMyThread failed:', caught);
      setActionError(messagesErrorMessage(caught, 'Could not reopen this conversation. Please try again.'));
      reloadThreads();
    } finally {
      setReopening(false);
    }
  };

  const closed = thread.status === 'closed';

  return (
    <div className="space-y-4 px-5">
      {thread.audience === 'admin' && (
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          This message went to the school office.
        </p>
      )}

      {loadError && messages === null ? (
        <LoadFailure message={loadError} onRetry={retry} />
      ) : messages === null ? (
        <ScreenSkeleton />
      ) : (
        <ul aria-label="Conversation" className="space-y-3">
          {messages.map((m) => (
            <Bubble key={m.messageId} message={m} thread={thread} now={now} />
          ))}
        </ul>
      )}
      {loadError && messages !== null && <p role="alert" className="text-sm font-medium text-danger-600">{loadError}</p>}

      <div ref={endRef} />

      {actionError && <p role="alert" className="text-sm font-medium text-danger-600">{actionError}</p>}

      {closed ? (
        <div className={`${cardClass} space-y-3 p-4 text-center`}>
          <p className="text-sm font-semibold text-gray-800">This conversation is closed.</p>
          {thread.canReopen ? (
            <button
              type="button"
              onClick={reopen}
              disabled={reopening}
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border-[1.5px] border-brand-100 bg-white px-4 text-sm font-bold text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50"
            >
              {reopening ? 'Reopening…' : 'Reopen conversation'}
            </button>
          ) : (
            <p className="text-sm text-gray-600">
              It can no longer be reopened.{' '}
              <Link href="/parent/messages" className="font-semibold text-brand-700 underline">Start a new message</Link> to ask something else.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="thread-reply" className="sr-only">Your reply</label>
          <textarea
            id="thread-reply"
            rows={3}
            value={reply}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Write a reply"
            onChange={(e) => setReply(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{reply.length}/{MAX_MESSAGE_LENGTH}</p>
            <button
              type="submit"
              disabled={sending || !isSendableBody(reply)}
              className="min-h-[2.75rem] rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ThreadScreen() {
  const params = useParams<{ threadId: string }>();
  const raw = params?.threadId;
  const threadId = Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
  const { threads, threadsError, reloadThreads } = useParent();
  const thread = threads?.find((t) => t.threadId === threadId) ?? null;

  if (threads === null && threadsError) {
    return (
      <>
        <TopBar eyebrow="Talk to the school" title="Conversation" backHref="/parent/messages" />
        <div className="px-5"><LoadFailure message={threadsError} onRetry={reloadThreads} /></div>
      </>
    );
  }
  if (threads === null) {
    return (
      <>
        <TopBar eyebrow="Talk to the school" title="Conversation" backHref="/parent/messages" />
        <ScreenSkeleton />
      </>
    );
  }
  if (!thread) {
    return (
      <>
        <TopBar eyebrow="Talk to the school" title="Conversation" backHref="/parent/messages" />
        <div className="px-5">
          <div className={`${cardClass} p-8 text-center`}>
            <h2 className="font-bold text-gray-900">Conversation not found</h2>
            <p className="mt-1 text-sm text-gray-500">It may have been removed, or your account no longer has access to it.</p>
            <Link href="/parent/messages" className="mt-5 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-brand-100 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              Back to messages
            </Link>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <TopBar eyebrow={`${audienceLabel(thread.audience)} · ${firstName(thread.studentName)}`} title={thread.subject} backHref="/parent/messages" />
      <ThreadView key={threadId} thread={thread} threadId={threadId} />
    </>
  );
}

export default function ThreadPage() {
  return <ThreadScreen />;
}
