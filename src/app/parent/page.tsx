'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, Clock, MessageCircle, Settings, type LucideIcon } from 'lucide-react';
import {
  getMyChildAttendance,
  getMyChildFees,
  createMyChildStatementToken,
  describeAnalyticsError,
} from '@/lib/analytics/api';
import { formatKes } from '@/lib/format-kes';
import {
  attendanceDays,
  daysUntil,
  feeTotals,
  firstName,
  greeting,
  openShareDocument,
} from '@/lib/parent/portal';
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
  Sidebar,
} from '@/components/parent/parts';
import { EventRowItem } from '@/components/parent/EventRowItem';
import type { MyChild } from '@/lib/analytics/api';

const TILES: { href: string; label: string; icon: LucideIcon; tone: 'brand' | 'ok' | 'warn' | 'bad' }[] = [
  { href: '/parent/timetable', label: 'Timetable', icon: Clock, tone: 'brand' },
  { href: '/parent/messages', label: 'Messages', icon: MessageCircle, tone: 'ok' },
  { href: '/parent/alerts?tab=calendar', label: 'Calendar', icon: CalendarDays, tone: 'warn' },
  { href: '/parent/profile', label: 'Settings', icon: Settings, tone: 'bad' },
];

function Home({ child }: { child: MyChild }) {
  const { events, unreadCount } = useParent();
  const fees = useChildData(child.studentId, getMyChildFees, 'Could not load fees.');
  const attendance = useChildData(child.studentId, (id, o) => getMyChildAttendance(id, undefined, o), 'Could not load attendance.');
  const [opening, setOpening] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const totals = fees.data ? feeTotals(fees.data) : null;
  const owed = totals ? totals.owed : null;
  const next = events[0];

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
    <div className="space-y-5 lg:space-y-8 px-5 lg:px-8">
      <ChildSwitcher />

      <section className="relative overflow-hidden rounded-3xl lg:grid lg:grid-cols-2 lg:gap-8 lg:py-12 lg:px-8 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 text-white shadow-lg" aria-label="Fee balance">
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

      <section className={`${cardClass} lg:grid-cols-5 lg:gap-4 lg:p-6`} aria-label="At a glance">
        <Stat value={attendance.data ? String(attendanceDays(attendance.data, 'present')) : '–'} label="Days present" />
        <Stat value={next ? `${Math.max(daysUntil(next.start_date), 0)}d` : '–'} label="Next event" />
        <Stat value={String(unreadCount)} label="New alerts" />
      </section>

      <nav aria-label="Shortcuts" className="lg:grid-cols-6 gap-2.5">
        {TILES.map(({ href, label, icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-1 py-3 text-center shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <IconTile icon={icon} tone={tone} />
            <span className="text-xs font-semibold text-gray-800">{label}</span>
          </Link>
        ))}
      </nav>

      <section>
        <SectionHeading
          title="Upcoming events"
          action={<Link href="/parent/alerts?tab=calendar" className="inline-flex min-h-[2.75rem] items-center px-1 text-sm font-bold text-brand-600">Calendar</Link>}
        />
        {events.length === 0 ? (
          <p className={`${cardClass} lg:mt-4 lg:p-6 mt-2 p-4 text-sm text-gray-500`}>No upcoming events.</p>
        ) : (
          <ul className="lg:mt-6 space-y-3.5">
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
      <Sidebar />
      <ChildGuard>{(child) => <Home key={child.studentId} child={child} />}</ChildGuard>
    </>
  );
}

