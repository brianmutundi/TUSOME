'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  ChevronLeft,
  Home,
  LayoutGrid,
  type LucideProps,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { Alert, Button, Skeleton } from '@/components/ui';
import { firstName, initials } from '@/lib/parent/portal';
import { useParent } from './ParentContext';

export const cardClass = 'rounded-2xl border border-gray-100 bg-white shadow-sm';

type Icon = ComponentType<LucideProps>;

/** Soft tinted square behind an icon. */
export function IconTile({ icon: I, tone = 'brand' }: { icon: Icon; tone?: 'brand' | 'ok' | 'warn' | 'bad' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    ok: 'bg-success-50 text-success-700',
    warn: 'bg-warning-50 text-warning-700',
    bad: 'bg-danger-50 text-danger-600',
  };
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
      <I className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export function TopBar({ eyebrow, title, backHref }: { eyebrow: string; title: string; backHref?: string }) {
  const { unreadCount } = useParent();
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-lg font-extrabold text-white" aria-hidden="true">
            T
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-500">{eyebrow}</p>
          <h1 className="break-words text-xl font-extrabold leading-tight text-gray-900">{title}</h1>
        </div>
      </div>
      <Link
        href="/parent/alerts"
        aria-label={`Notifications, ${unreadCount} unread`}
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full border-2 border-gray-50 bg-danger-600 px-1 text-[11px] font-extrabold text-white">
            {unreadCount}
          </span>
        )}
      </Link>
    </div>
  );
}

export function ChildSwitcher() {
  const { kids, child, selectChild } = useParent();
  if (!kids || kids.length < 2) return null;
  return (
    <div className="flex gap-2" role="group" aria-label="Choose child">
      {kids.map((k) => {
        const on = k.studentId === child?.studentId;
        return (
          <button
            key={k.studentId}
            type="button"
            aria-pressed={on}
            onClick={() => selectChild(k.studentId)}
            className={`flex min-h-[3.5rem] flex-1 items-center gap-2.5 rounded-2xl border-2 bg-white px-3 py-2 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${on ? 'border-brand-600' : 'border-transparent'}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-extrabold text-brand-600">
              {initials(k.fullName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-gray-900">{firstName(k.fullName)}</span>
              <span className="block truncate text-xs text-gray-500">{k.className ?? `Adm ${k.admissionNo}`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Renders children once a child is selected; handles loading, error and no-links states. */
export function ChildGuard({ children }: { children: (child: NonNullable<ReturnType<typeof useParent>['child']>) => ReactNode }) {
  const { kids, child, loadError } = useParent();
  if (loadError) {
    return (
      <div className="px-5">
        <Alert tone="error" title="Could not load">
          {loadError}
        </Alert>
      </div>
    );
  }
  if (kids === null) return <ScreenSkeleton />;
  if (!child) {
    return (
      <div className="px-5">
        <div className={`${cardClass} p-8 text-center`}>
          <h2 className="font-bold text-gray-900">No children linked yet</h2>
          <p className="mt-1 text-sm text-gray-500">Ask the school office to link your account to your child.</p>
        </div>
      </div>
    );
  }
  return <>{children(child)}</>;
}

export function ScreenSkeleton() {
  return (
    <div className="space-y-4 px-5" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-14" />
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {action}
    </div>
  );
}

export function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      tone="error"
      title="Could not load"
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      {message}
    </Alert>
  );
}

export function ComingSoon({ icon: I, title, text, eyebrow, backHref }: { icon: Icon; title: string; text: string; eyebrow: string; backHref?: string }) {
  return (
    <>
      <TopBar eyebrow={eyebrow} title={title} backHref={backHref} />
      <div className="px-5">
        <div className={`${cardClass} p-8 text-center`}>
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <I className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="font-bold text-gray-900">Coming soon</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-gray-500">{text}</p>
          <Link href="/parent" className="mt-5 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-brand-100 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Back to home
          </Link>
        </div>
      </div>
    </>
  );
}

const NAV: { href: string; label: string; icon: Icon; match: (p: string) => boolean; badge?: 'homework' | 'messages' }[] = [
  { href: '/parent', label: 'Home', icon: Home, match: (p) => p === '/parent' },
  { href: '/parent/fees', label: 'Fees', icon: Wallet, match: (p) => p.startsWith('/parent/fees') },
  { href: '/parent/homework', label: 'Homework', icon: BookOpen, match: (p) => p.startsWith('/parent/homework'), badge: 'homework' },
  { href: '/parent/results', label: 'Results', icon: BarChart3, match: (p) => p.startsWith('/parent/results') },
  {
    href: '/parent/more',
    label: 'More',
    icon: LayoutGrid,
    match: (p) => /^\/parent\/(more|alerts|profile|messages|timetable)/.test(p),
  },
];

export function Sidebar() {
  const { kids, child } = useParent();
  const pathname = usePathname() ?? '/parent';
  const on = (href: string) => {
    const match = NAV.find((n) => n.href === href)?.match;
    return match ? match(pathname) : href === pathname;
  };
  return (
    <aside
      className="lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:z-10 bg-white border-r border-gray-100 shadow-2xl flex flex-col pt-6"
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center justify-between px-6">
        <span className="text-sm font-medium text-gray-900">Tusome</span>
        <button
          aria-label="Close sidebar"
          className="lg:hidden p-2"
          onClick={() => window.location.hash = ''}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Sidebar nav" className="flex-1 pt-2">
        <ul className="space-y-1 px-2">
          {NAV.map(({ href, label, icon: I }) => (
            <li key={href} className="group">
              <Link
                href={href}
                aria-current={on(href) ? 'page' : undefined}
                className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-gray-700 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors lg:w-full"
              >
                <I className="h-4 w-4 mr-2" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname() ?? '';
  const { homeworkTodo, messagesTodo } = useParent();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white shadow-[0_-8px_24px_rgba(18,38,42,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto flex max-w-lg px-1 py-2">
        {NAV.map(({ href, label, icon: I, match, badge }) => {
          const on = match(pathname);
          const count = badge === 'homework' ? homeworkTodo : badge === 'messages' ? messagesTodo : 0;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                aria-label={count > 0 ? `${label}, ${count} unread` : undefined}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl text-[11.5px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${on ? 'text-brand-600' : 'text-gray-500'}`}
              >
                <span className={`relative grid h-7 w-11 place-items-center rounded-full ${on ? 'bg-brand-50' : ''}`}>
                  <I className="h-5 w-5" aria-hidden="true" />
                  {count > 0 && (
                    <span className="absolute -right-0.5 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-extrabold leading-none text-white" aria-hidden="true">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

