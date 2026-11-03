'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bell, CornerDownLeft, LayoutGrid, Search } from 'lucide-react';
import { Modal } from '@/components/overlays';
import { Popover } from '@/components/popover';
import { ProfileMenu } from '@/components/shell/ProfileMenu';
import {
  HOME_ITEM,
  NAV_GROUPS,
  findActiveNav,
  searchNavForRole,
  navGroupsForRole,
  type NavGroup,
} from '@/components/shell/nav';

const RAIL_ITEM =
  'relative flex w-14 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

function railTone(active: boolean, open = false): string {
  return active
    ? 'bg-white/15 text-white'
    : `text-slate-300 hover:bg-white/10 hover:text-white ${open ? 'bg-white/10 text-white' : ''}`;
}

function GroupFlyout({ group, activeHref }: { group: NavGroup; activeHref: string | null }) {
  const wide = group.items.length > 6;
  return (
    <div className={wide ? 'w-[26rem]' : 'w-64'}>
      <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {group.title}
      </p>
      <div className={`grid gap-0.5 p-1.5 ${wide ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {group.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            aria-current={item.href === activeHref ? 'page' : undefined}
            className="flex min-h-[2.5rem] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none aria-[current=page]:bg-blue-50 aria-[current=page]:text-blue-800"
          >
            <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Rail({
  groups,
  role,
  activeGroupId,
  activeHref,
  onSearch,
}: {
  groups: NavGroup[];
  role?: string | null;
  activeGroupId: string | null;
  activeHref: string | null;
  onSearch: () => void;
}) {
  const isPlatformOwner = role === 'super admin';
  const homeActive = activeHref === HOME_ITEM.href;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center gap-1 overflow-y-auto bg-slate-900 py-3 print:hidden lg:flex"
    >
      <Link
        href="/analytics"
        aria-label="TUSOME home"
        className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        T
      </Link>

      {!isPlatformOwner && (
        <Link
          href={HOME_ITEM.href}
          aria-current={homeActive ? 'page' : undefined}
          className={`${RAIL_ITEM} ${railTone(homeActive)}`}
        >
          <HOME_ITEM.icon aria-hidden="true" className="h-5 w-5" />
          Home
        </Link>
      )}

      {groups.map((group) => {
        const active = group.id === activeGroupId;
        return (
          <Popover
            key={group.id}
            side="right"
            role="menu"
            label={group.title}
            trigger={({ props, open }) => (
              <button
                {...props}
                type="button"
                aria-label={group.title}
                data-active={active || undefined}
                className={`${RAIL_ITEM} ${railTone(active, open)}`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-2 top-2 h-8 w-1 rounded-r-full bg-blue-400"
                  />
                )}
                <group.icon aria-hidden="true" className="h-5 w-5" />
                <span aria-hidden="true">{group.short}</span>
              </button>
            )}
          >
            <GroupFlyout group={group} activeHref={activeHref} />
          </Popover>
        );
      })}

      <button
        type="button"
        onClick={onSearch}
        aria-label="Search pages"
        className={`${RAIL_ITEM} mt-auto text-slate-300 hover:bg-white/10 hover:text-white`}
      >
        <Search aria-hidden="true" className="h-5 w-5" />
        <span aria-hidden="true">Search</span>
      </button>
    </nav>
  );
}

const MOBILE_GROUP_IDS = ['students', 'academics', 'finance'] as const;

function MobileBar({
  groups,
  role,
  activeGroupId,
  homeActive,
  onOpen,
}: {
  groups: NavGroup[];
  role?: string | null;
  activeGroupId: string | null;
  homeActive: boolean;
  onOpen: (sheet: string) => void;
}) {
  const isPlatformOwner = role === 'super admin';
  if (isPlatformOwner) return null;
  const quick = MOBILE_GROUP_IDS.map((id) => groups.find((g) => g.id === id)).filter(
    (g): g is NavGroup => Boolean(g)
  );
  const base =
    'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-4';
  const tone = (active: boolean) => (active ? 'text-blue-700' : 'text-gray-600');
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden"
    >
      <Link
        href={HOME_ITEM.href}
        aria-current={homeActive ? 'page' : undefined}
        className={`${base} ${tone(homeActive)}`}
      >
        <HOME_ITEM.icon aria-hidden="true" className="h-5 w-5" />
        Home
      </Link>
      {quick.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onOpen(group.id)}
          className={`${base} ${tone(group.id === activeGroupId)}`}
        >
          <group.icon aria-hidden="true" className="h-5 w-5" />
          {group.short}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onOpen('menu')}
        className={`${base} ${tone(
          Boolean(activeGroupId) && !MOBILE_GROUP_IDS.includes(activeGroupId as never)
        )}`}
      >
        <LayoutGrid aria-hidden="true" className="h-5 w-5" />
        Menu
      </button>
    </nav>
  );
}

function SheetLinks({
  group,
  activeHref,
  onNavigate,
}: {
  group: NavGroup;
  activeHref: string | null;
  onNavigate: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 min-[420px]:grid-cols-2">
      {group.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={item.href === activeHref ? 'page' : undefined}
          className="flex min-h-[2.75rem] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 aria-[current=page]:bg-blue-50 aria-[current=page]:text-blue-800"
        >
          <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

function NavSheet({
  groups,
  sheet,
  activeHref,
  onClose,
  onSearch,
}: {
  groups: NavGroup[];
  sheet: string | null;
  activeHref: string | null;
  onClose: () => void;
  onSearch: () => void;
}) {
  const single = groups.find((g) => g.id === sheet) ?? null;
  const isMenu = sheet === 'menu';
  return (
    <Modal
      open={sheet !== null}
      onClose={onClose}
      title={single ? single.title : 'All sections'}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-[2.75rem] rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Close
        </button>
      }
    >
      {single && <SheetLinks group={single} activeHref={activeHref} onNavigate={onClose} />}
      {isMenu && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSearch();
            }}
            className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            Search pages…
          </button>
          {groups.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {group.title}
              </h3>
              <SheetLinks group={group} activeHref={activeHref} onNavigate={onClose} />
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role?: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => searchNavForRole(query, role).slice(0, 40), [query, role]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal open={open} onClose={onClose} title="Go to a page">
      <div className="-mx-1">
        <label htmlFor="palette-input" className="sr-only">
          Search pages
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
          <Search aria-hidden="true" className="h-4 w-4 text-gray-400" />
          <input
            id="palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined}
            autoComplete="off"
            value={query}
            placeholder="Students, fee waivers, payroll…"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const hit = results[active];
                if (hit) go(hit.href);
              }
            }}
            className="min-h-[2.75rem] w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <ul
          ref={listRef}
          id="palette-list"
          role="listbox"
          aria-label="Pages"
          className="mt-2 max-h-[min(20rem,50dvh)] overflow-y-auto"
        >
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-gray-500">
              No page matches “{query}”.
            </li>
          )}
          {results.map((entry, index) => (
            <li
              key={entry.href}
              id={`palette-opt-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === active}
              onMouseMove={() => setActive(index)}
              onClick={() => go(entry.href)}
              className={`flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                index === active ? 'bg-blue-50 text-blue-900' : 'text-gray-800'
              }`}
            >
              <entry.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
              <span className="shrink-0 text-xs text-gray-500">{entry.groupTitle}</span>
              {index === active && (
                <CornerDownLeft aria-hidden="true" className="hidden h-3.5 w-3.5 text-blue-700 sm:block" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function InboxMenu() {
  const links = [
    { href: '/analytics/messages', label: 'Send an SMS or message', hint: 'Parents, staff, classes' },
    { href: '/analytics/events', label: 'Events & notices', hint: 'Calendar and announcements' },
    { href: '/analytics/leave', label: 'Leave requests', hint: 'Approve or decline' },
    { href: '/analytics/fee-waivers', label: 'Fee waiver approvals', hint: 'Pending reviews' },
  ];
  return (
    <Popover
      label="Messages and approvals"
      align="end"
      role="menu"
      trigger={({ props, open }) => (
        <button
          {...props}
          type="button"
          aria-label="Messages and approvals"
          data-open={open || undefined}
          className="grid h-11 w-11 place-items-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 data-[open]:bg-gray-100"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
      className="w-72"
    >
      <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Shortcuts
      </p>
      <div className="p-1.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            role="menuitem"
            className="block rounded-lg px-3 py-2 hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
          >
            <span className="block text-sm font-medium text-gray-900">{l.label}</span>
            <span className="block text-xs text-gray-500">{l.hint}</span>
          </Link>
        ))}
      </div>
    </Popover>
  );
}

export function AppShell({
  children,
  email,
  fullName,
  role,
  isAdmin,
  onSignOut,
}: {
  children: ReactNode;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  isAdmin?: boolean;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const active = useMemo(() => findActiveNav(pathname), [pathname]);
  const groups = useMemo(() => navGroupsForRole(role), [role]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeHref = active.item?.href ?? null;

  return (
    <div className="min-h-screen lg:pl-[72px]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-blue-700 focus:shadow-md"
      >
        Skip to content
      </a>

      <Rail
        groups={groups}
        role={role}
        activeGroupId={active.group?.id ?? null}
        activeHref={activeHref}
        onSearch={() => setPaletteOpen(true)}
      />

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-3 backdrop-blur print:hidden sm:px-5">
        <Link
          href={role === 'super admin' ? '/analytics/schools' : '/analytics'}
          className="flex items-center gap-2 lg:hidden"
          aria-label="TUSOME home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            T
          </span>
        </Link>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 truncate text-sm">
            {active.group && (
              <>
                <li className="hidden truncate text-gray-500 sm:block">{active.group.title}</li>
                <li aria-hidden="true" className="hidden text-gray-300 sm:block">
                  /
                </li>
              </>
            )}
            <li className="truncate font-semibold text-gray-900">
              {active.item?.label ?? 'TUSOME'}
            </li>
          </ol>
        </nav>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden min-h-[2.5rem] w-64 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-white md:flex"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          <span className="flex-1 text-left">Search pages…</span>
          <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          aria-label="Search pages"
          onClick={() => setPaletteOpen(true)}
          className="grid h-11 w-11 place-items-center rounded-full text-gray-600 hover:bg-gray-100 md:hidden"
        >
          <Search aria-hidden="true" className="h-5 w-5" />
        </button>

        {role !== 'super admin' && <InboxMenu />}
        <ProfileMenu
          email={email}
          fullName={fullName}
          role={role}
          isAdmin={isAdmin}
          showAdminLinks={role !== 'super admin'}
          onSignOut={onSignOut}
        />
      </header>

      <div id="main" tabIndex={-1} className="p-2 pb-24 outline-none sm:p-4 lg:p-5 lg:pb-6">
        {children}
      </div>

      <MobileBar
        groups={groups}
        role={role}
        activeGroupId={active.group?.id ?? null}
        homeActive={activeHref === HOME_ITEM.href}
        onOpen={setSheet}
      />
      <NavSheet
        groups={groups}
        sheet={sheet}
        activeHref={activeHref}
        onClose={() => setSheet(null)}
        onSearch={() => setPaletteOpen(true)}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={role} />
    </div>
  );
}
