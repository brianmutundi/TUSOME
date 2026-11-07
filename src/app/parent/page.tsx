'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, Clock, MessageCircle, Settings, type LucideIcon } from 'lucide-react';
import {
  getMyChildAttendance,
  getMyChildFees,
  getMyChildResults,
  createMyChildStatementToken,
  describeAnalyticsError,
} from '@/lib/analytics/api';
import { formatKes } from '@/lib/format-kes';
import {
  attendanceDays,
  daysUntil,
  feeTotals,
  firstName,
  formatScore,
  greeting,
  groupResults,
  openShareDocument,
} from '@/lib/parent/portal';
import { homeworkDueLabel, splitHomework } from '@/lib/homework';
import { useChildData } from '@/lib/parent/useChildData';
import { useParent } from '@/components/parent/ParentContext';
import { PaybillButton } from '@/components/parent/PaybillSheet';
import {
  ChildGuard,
  ChildSwitcher,
  IconTile,
  LoadFailure,
  SectionHeading,
  TopBar,
  cardClass,
} from '@/components/parent/parts';
import { EventRowItem } from '@/components/parent/EventRowItem';
import type { MyChild } from '@/lib/analytics/api';

type TileBadge = 'homework' | 'messages';

const TILES: { href: string; label: string; icon: LucideIcon; tone: 'brand' | 'ok' | 'warn' | 'bad'; badge?: TileBadge }[] = [
  { href: '/parent/timetable', label: 'Timetable', icon: Clock, tone: 'brand' },
  { href: '/parent/homework', label: 'Homework', icon: BookOpen, tone: 'warn', badge: 'homework' },
  { href: '/parent/messages', label: 'Messages', icon: MessageCircle, tone: 'ok', badge: 'messages' },
  { href: '/parent/profile', label: 'Settings', icon: Settings, tone: 'bad' },
];

/** Homework items shown on the home screen; the full list is one tap away. */
const HOME_HOMEWORK_LIMIT = 3;

function Home({ child }: { child: MyChild }) {
  const { events, unreadCount, homework, homeworkError, reloadHomework, messagesUnread } = useParent();
  const fees = useChildData(child.studentId, getMyChildFees, 'Could not load fees.');
  const attendance = useChildData(child.studentId, (id, o) => getMyChildAttendance(id, undefined, o), 'Could not load attendance.');
  const results = useChildData(child.studentId, getMyChildResults, 'Could not load results.');
  const [opening, setOpening] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const totals = fees.data ? feeTotals(fees.data) : null;
  const owed = totals ? totals.owed : null;
  const next = events[0];
  const now = new Date();
  const split = homework ? splitHomework(homework, now) : null;
  const openHomework = split ? [...split.overdue, ...split.todo] : [];
  const latestExam = results.data ? groupResults(results.data)[0] ?? null : null;

  const openStatement = async () => {
    setOpening(true);
    setActionError(null);
    try {
      await openShareDocument(() => createMyChildStatementToken(child.studentId), (t) => `/statement/${t}`);
    } catch (e) {
      setActionError(describeAnalyticsError(e, 'Could not open statement.'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-5 px-5">
      <ChildSwitcher />

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 p-5 text-white shadow-lg" aria-label="Fee balance">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
        <p className="relative text-sm font-semibold text-white/90">Balance to pay · {firstName(child.fullName)}</p>
        {fees.error ? (
          <div className="relative mt-3"><LoadFailure message={fees.error} onRetry={fees.retry} /></div>
        ) : (
          <>
            <p className="relative mt-1 text-3xl font-extrabold tracking-tight">{owed === null ? '…' : formatKes(owed)}</p>
            {owed !== null && (
              <span className="relative mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                {owed > 0 ? 'Balance due' : 'Fees cleared'}
              </span>
            )}
            {totals && totals.billed > 0 && (
              <div className="relative mt-4">
                <div
                  role="progressbar"
                  aria-label="Fees paid this term"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(totals.percentPaid)}
                  className="h-2 overflow-hidden rounded-full bg-white/25"
                >
                  <div className="h-full rounded-full bg-white" style={{ width: `${totals.percentPaid}%` }} />
                </div>
                <p className="mt-1.5 flex justify-between text-xs font-semibold text-white/90">
                  <span>Paid {formatKes(totals.paid)}</span>
                  <span>Billed {formatKes(totals.billed - totals.waived)}</span>
                </p>
              </div>
            )}
          </>
        )}
        <div className="relative mt-4 flex gap-2.5">
          <PaybillButton
            studentId={child.studentId}
            className="min-h-[2.875rem] flex-1 rounded-xl bg-white/90 px-2 text-sm font-bold text-brand-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          />
          <button
            type="button"
            onClick={openStatement}
            disabled={opening}
            className="min-h-[2.875rem] flex-1 rounded-xl bg-white/20 px-2 text-sm font-bold text-white hover:bg-white/30 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {opening ? 'Opening…' : 'Statement'}
          </button>
        </div>
      </section>
      {actionError && <p role="alert" className="text-sm font-medium text-danger-600">{actionError}</p>}

      <section className={`${cardClass} grid grid-cols-3 gap-2.5 p-4`} aria-label="At a glance">
        <Stat value={attendance.data ? String(attendanceDays(attendance.data, 'present')) : '–'} label="Days present" />
        <Stat value={next ? `${Math.max(daysUntil(next.start_date), 0)}d` : '–'} label="Next event" />
        <Stat value={String(unreadCount)} label="New alerts" />
      </section>

      <nav aria-label="Shortcuts" className="grid grid-cols-4 gap-2.5">
        {TILES.map(({ href, label, icon, tone, badge }) => {
          const count = badge === 'homework' ? split?.todo.length ?? 0 : badge === 'messages' ? messagesUnread : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-label={count > 0 ? `${label}, ${count} ${badge === 'messages' ? 'unread' : 'to do'}` : undefined}
              className="relative flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-1 py-3 text-center shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <IconTile icon={icon} tone={tone} />
              <span className="text-xs font-semibold text-gray-800">{label}</span>
              {count > 0 && (
                <span className="absolute right-2 top-2 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-danger-600 px-1 text-xs font-extrabold leading-none text-white" aria-hidden="true">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <section aria-label="Homework">
        <SectionHeading
          title="Homework due"
          action={<Link href="/parent/homework" className="inline-flex min-h-[2.75rem] items-center px-1 text-sm font-bold text-brand-600">See all</Link>}
        />
        {homeworkError ? (
          <div className="mt-2"><LoadFailure message={homeworkError} onRetry={reloadHomework} /></div>
        ) : homework === null ? (
          <p className={`${cardClass} mt-2 p-4 text-sm text-gray-500`}>Loading homework…</p>
        ) : openHomework.length === 0 ? (
          <p className={`${cardClass} mt-2 p-4 text-sm text-gray-500`}>Nothing to do. All homework is ticked off.</p>
        ) : (
          <ul className={`${cardClass} mt-2 divide-y divide-gray-100`}>
            {openHomework.slice(0, HOME_HOMEWORK_LIMIT).map((h) => {
              const overdue = split ? split.overdue.includes(h) : false;
              return (
                <li key={h.assignmentId} className="px-4 py-3">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{h.subjectName}</span>
                    <span className={`text-xs font-semibold ${overdue ? 'text-danger-600' : 'text-gray-700'}`}>{homeworkDueLabel(h.dueDate, now)}</span>
                  </p>
                  <p className="mt-1 break-words text-sm font-bold text-gray-900">{h.title}</p>
                </li>
              );
            })}
            {openHomework.length > HOME_HOMEWORK_LIMIT && (
              <li className="px-4 py-2.5 text-xs font-semibold text-gray-500">
                +{openHomework.length - HOME_HOMEWORK_LIMIT} more
              </li>
            )}
          </ul>
        )}
      </section>

      {results.error ? (
        <section aria-label="Latest results">
          <LoadFailure message={results.error} onRetry={results.retry} />
        </section>
      ) : (
        latestExam && (
          <section aria-label="Latest results">
            <SectionHeading
              title="Latest results"
              action={<Link href="/parent/results" className="inline-flex min-h-[2.75rem] items-center px-1 text-sm font-bold text-brand-600">All results</Link>}
            />
            <Link
              href="/parent/results"
              className={`${cardClass} mt-2 flex items-center gap-4 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600`}
            >
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-gray-900">{latestExam.name}</p>
                {latestExam.strongest && (
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Strongest: {latestExam.strongest.subjectName} ({formatScore(latestExam.strongest)})
                  </p>
                )}
              </div>
              {latestExam.average !== null && (
                <div className="text-right">
                  <b className="block text-2xl font-extrabold text-brand-600">{Math.round(latestExam.average)}%</b>
                  <span className="text-xs font-semibold text-gray-500">Average</span>
                </div>
              )}
            </Link>
          </section>
        )
      )}

      <section>
        <SectionHeading
          title="Upcoming events"
          action={<Link href="/parent/alerts?tab=calendar" className="inline-flex min-h-[2.75rem] items-center px-1 text-sm font-bold text-brand-600">Calendar</Link>}
        />
        {events.length === 0 ? (
          <p className={`${cardClass} mt-2 p-4 text-sm text-gray-500`}>No upcoming events.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {events.slice(0, 2).map((e) => (
              <EventRowItem key={e.event_id} event={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-1.5 py-3 text-center">
      <b className="block text-lg font-extrabold text-brand-600">{value}</b>
      <span className="text-xs font-semibold text-gray-500">{label}</span>
    </div>
  );
}

export default function ParentHomePage() {
  return (
    <>
      <TopBar eyebrow={greeting()} title="Welcome back" />
      <ChildGuard>{(child) => <Home key={child.studentId} child={child} />}</ChildGuard>
    </>
  );
}

