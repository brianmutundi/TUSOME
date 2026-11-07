'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bell, CalendarDays, FileText, Siren, type LucideIcon } from 'lucide-react';
import { useParent } from '@/components/parent/ParentContext';
import { EventRowItem } from '@/components/parent/EventRowItem';
import { IconTile, TopBar, cardClass } from '@/components/parent/parts';

const NOTICE_ICON: Record<string, { icon: LucideIcon; tone: 'brand' | 'ok' | 'warn' | 'bad' }> = {
  urgent: { icon: Siren, tone: 'bad' },
  reminder: { icon: Bell, tone: 'warn' },
  academic: { icon: FileText, tone: 'ok' },
  general: { icon: Bell, tone: 'brand' },
};

function Alerts() {
  const { notices, events, unreadCount, markRead } = useParent();
  const params = useSearchParams();
  const [tab, setTab] = useState<'alerts' | 'calendar'>(params.get('tab') === 'calendar' ? 'calendar' : 'alerts');
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <TopBar eyebrow="School notifications" title="Alerts and events" backHref="/parent" />
      <div className="space-y-4 px-5">
        <div role="tablist" className="flex gap-0.5 rounded-2xl bg-white p-1.5 shadow-sm">
          {(['alerts', 'calendar'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-[2.75rem] flex-1 rounded-xl text-sm font-bold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${tab === t ? 'bg-brand-600 text-white shadow' : 'text-gray-500'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'alerts' ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{unreadCount ? `${unreadCount} new` : 'All caught up'}</h2>
              {unreadCount > 0 && (
                <button type="button" onClick={() => markRead(notices.map((n) => n.noticeId))} className="min-h-[2.75rem] px-1 text-sm font-bold text-brand-600">
                  Mark all read
                </button>
              )}
            </div>
            {notices.length === 0 ? (
              <p className={`${cardClass} p-6 text-center text-sm text-gray-500`}>No notices from the school yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {notices.map((n) => {
                  const unread = !n.isRead;
                  const open = openId === n.noticeId;
                  const { icon, tone } = NOTICE_ICON[n.noticeType] ?? NOTICE_ICON.general;
                  return (
                    <li key={n.noticeId}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => {
                          setOpenId(open ? null : n.noticeId);
                          if (unread) markRead([n.noticeId]);
                        }}
                        className={`${cardClass} flex w-full items-start gap-3 p-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${unread ? 'border-l-4 border-l-brand-600' : ''}`}
                      >
                        <IconTile icon={icon} tone={tone} />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-bold text-gray-900">{n.title}</span>
                          <span className={`mt-0.5 block whitespace-pre-line break-words text-[13px] leading-snug text-gray-500 ${open ? '' : 'line-clamp-2'}`}>{n.content}</span>
                          <span className="mt-1 block text-xs font-semibold text-gray-500">
                            {new Date(n.publishedAt ?? n.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : events.length === 0 ? (
          <p className={`${cardClass} p-6 text-center text-sm text-gray-500`}>
            <CalendarDays className="mx-auto mb-2 h-6 w-6 text-brand-600" aria-hidden="true" />
            No upcoming events.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {events.map((e) => (
              <EventRowItem key={e.event_id} event={e} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={null}>
      <Alerts />
    </Suspense>
  );
}
