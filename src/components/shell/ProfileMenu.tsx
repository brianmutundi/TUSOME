'use client';

import Link from 'next/link';
import { LogOut, Settings, UserCog } from 'lucide-react';
import { Popover } from '@/components/popover';
import { Avatar, ProfileCard } from '@/components/profile';
import { Badge } from '@/components/ui';
import { roleLabel } from '@/lib/analytics/accounts';

export function displayNameFor(email: string | null | undefined, fullName?: string | null): string {
  const named = (fullName ?? '').trim();
  if (named) return named;
  const local = (email ?? '').split('@')[0] ?? '';
  const spaced = local.replace(/[._-]+/g, ' ').trim();
  if (!spaced) return 'Signed-in user';
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

const rowClass =
  'flex min-h-[2.5rem] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none';

/** Avatar button that opens a profile card with account links and sign out. */
export function ProfileMenu({
  email,
  fullName,
  role,
  isAdmin = false,
  showAdminLinks = true,
  onSignOut,
}: {
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  isAdmin?: boolean;
  showAdminLinks?: boolean;
  onSignOut: () => void;
}) {
  const name = displayNameFor(email, fullName);
  return (
    <Popover
      label="Account"
      align="end"
      trigger={({ props, open }) => (
        <button
          {...props}
          type="button"
          aria-label={`Account: ${name}`}
          data-open={open || undefined}
          className="flex min-h-[2.75rem] items-center gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-gray-100 data-[open]:bg-gray-100 sm:pr-3"
        >
          <Avatar name={name} size="sm" />
          <span className="hidden max-w-[10rem] truncate text-sm font-medium text-gray-800 sm:inline">
            {name}
          </span>
        </button>
      )}
      className="w-72"
    >
      {({ close }) => (
        <div>
          <div className="border-b border-gray-100 p-4">
            <ProfileCard
              name={name}
              subtitle={email ?? undefined}
              badges={
                <>
                  {role && (
                    <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                      {roleLabel(role)}
                    </Badge>
                  )}
                  {isAdmin && (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-900">Admin</Badge>
                  )}
                </>
              }
            />
          </div>
          {showAdminLinks && (
            <div className="p-1.5">
              <Link href="/analytics/settings" className={rowClass}>
                <Settings aria-hidden="true" className="h-4 w-4 text-gray-500" />
                School settings
              </Link>
              {isAdmin && (
                <Link href="/analytics/accounts" className={rowClass}>
                  <UserCog aria-hidden="true" className="h-4 w-4 text-gray-500" />
                  Accounts &amp; roles
                </Link>
              )}
            </div>
          )}
          <div className="border-t border-gray-100 p-1.5">
            <button
              type="button"
              className={`${rowClass} text-red-700 hover:bg-red-50`}
              onClick={() => {
                close();
                onSignOut();
              }}
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
