'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, MessageCircle, Plus } from 'lucide-react';
import { NewMessageSheet } from '@/components/parent/NewMessageSheet';
import { useParent } from '@/components/parent/ParentContext';
import { ChildGuard, IconTile, LoadFailure, ScreenSkeleton, TopBar, cardClass } from '@/components/parent/parts';
import type { MyThread } from '@/lib/analytics/api';
import { audienceLabel, formatThreadTime, previewText } from '@/lib/messages';
import { firstName } from '@/lib/parent/portal';

function ThreadRow({ thread, showChild, now }: { thread: MyThread; showChild: boolean; now: Date }) {
  const closed = thread.status === 'closed';
  return (
    <li>
      <Link
        href={`/parent/messages/${thread.threadId}`}
        aria-label={`${thread.subject}${thread.isUnread ? ', unread reply' : ''}`}
        className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
      >
        <IconTile icon={MessageCircle} tone={thread.isUnread ? 'brand' : 'ok'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-sm ${thread.isUnread ? 'font-extrabold text-gray-900' : 'font-bold text-gray-900'}`}>{thread.subject}</span>
            <span className="shrink-0 text-xs text-gray-500">{formatThreadTime(thread.lastMessageAt, now)}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-gray-600">
            {thread.lastSenderKind === 'parent' ? 'You: ' : ''}
            {previewText(thread.lastMessagePreview)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <span>{audienceLabel(thread.audience)}</span>
            {showChild && <span>· {firstName(thread.studentName)}</span>}
            {closed && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">Closed</span>}
            {thread.isUnread && <span className="rounded-full bg-brand-600 px-2 py-0.5 font-bold text-white">New reply</span>}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
      </Link>
    </li>
  );
}

function MessagesBody() {
  const { kids, threads, threadsError, reloadThreads } = useParent();
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [now] = useState(() => new Date());

  if (threads === null && threadsError) {
    return <div className="px-5"><LoadFailure message={threadsError} onRetry={reloadThreads} /></div>;
  }
  if (threads === null) return <ScreenSkeleton />;

  return (
    <div className="space-y-4 px-5">
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New message
      </button>

      {threads.length === 0 ? (
        <div className={`${cardClass} p-8 text-center`}>
          <h2 className="font-bold text-gray-900">No messages yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-gray-500">
            Write to your child&apos;s class teacher, the bursar or the school office. Replies appear here.
          </p>
        </div>
      ) : (
        <ul className={`${cardClass} divide-y divide-gray-100 overflow-hidden`}>
          {threads.map((t) => (
            <ThreadRow key={t.threadId} thread={t} showChild={(kids?.length ?? 0) > 1} now={now} />
          ))}
        </ul>
      )}

      {composing && (
        <NewMessageSheet
          onClose={() => setComposing(false)}
          onCreated={(threadId) => {
            setComposing(false);
            router.push(`/parent/messages/${threadId}`);
          }}
        />
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <>
      <TopBar eyebrow="Talk to the school" title="Messages" backHref="/parent/more" />
      <ChildGuard>{() => <MessagesBody />}</ChildGuard>
    </>
  );
}
