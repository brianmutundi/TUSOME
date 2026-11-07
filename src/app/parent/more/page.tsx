'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Clock, LogOut, MessageCircle, User, type LucideIcon } from 'lucide-react';
import { useParent } from '@/components/parent/ParentContext';
import { TopBar, cardClass } from '@/components/parent/parts';

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/parent/messages', label: 'Messages', icon: MessageCircle },
  { href: '/parent/timetable', label: 'Timetable', icon: Clock },
  { href: '/parent/alerts?tab=calendar', label: 'School calendar', icon: CalendarDays },
  { href: '/parent/profile', label: 'Profile and settings', icon: User },
];

const rowClass = 'flex min-h-[3.625rem] w-full items-center justify-between gap-3 border-b border-gray-100 px-4 text-left last:border-b-0 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600';

export default function MorePage() {
  const { signOut, messagesUnread } = useParent();
  return (
    <>
      <TopBar eyebrow="Account and school" title="More" />
      <div className="px-5">
        <ul className={`${cardClass} overflow-hidden`}>
          {ITEMS.map(({ href, label, icon: I }) => (
            <li key={href}>
              <Link href={href} className={rowClass}>
                <span className="flex items-center gap-3 text-sm font-bold text-gray-900">
                  <I className="h-5 w-5 text-brand-600" aria-hidden="true" />
                  {label}
                </span>
                {href === '/parent/messages' && messagesUnread > 0 ? (
                  <span className="flex items-center gap-2">
                    <span className="grid h-6 min-w-[1.5rem] place-items-center rounded-full bg-danger-600 px-1.5 text-xs font-extrabold text-white">
                      {messagesUnread}
                      <span className="sr-only"> unread</span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-500" aria-hidden="true" />
                  </span>
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" aria-hidden="true" />
                )}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={signOut} className={rowClass}>
              <span className="flex items-center gap-3 text-sm font-bold text-danger-600">
                <LogOut className="h-5 w-5" aria-hidden="true" />
                Sign out
              </span>
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}
