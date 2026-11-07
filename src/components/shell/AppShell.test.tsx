import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const api = vi.hoisted(() => ({ listParentThreads: vi.fn() }));
vi.mock('@/lib/analytics/api', () => ({ ...api, isAbortError: () => false }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/analytics',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AppShell } from './AppShell';

const unread = (id: string) => ({ threadId: id, isUnread: true });

beforeEach(() => {
  vi.clearAllMocks();
  api.listParentThreads.mockResolvedValue([unread('1'), unread('2')]);
});

const shell = (permissions: string[], role = 'admin') =>
  render(
    <AppShell email="a@x.test" fullName="A" role={role} permissions={permissions} onSignOut={vi.fn()}>
      <p>page</p>
    </AppShell>
  );

describe('staff unread parent messages badge', () => {
  it('shows the count on the bell and the Communication rail button for staff with the permission', async () => {
    shell(['reply-parent-messages']);
    expect(await screen.findByRole('button', { name: 'Messages and approvals, 2 unread parent messages' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /, 2 unread$/ }).length).toBeGreaterThan(0);
  });

  it('makes no request for staff who cannot open parent messages', () => {
    shell([]);
    expect(api.listParentThreads).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Messages and approvals' })).toBeInTheDocument();
  });

  it('makes no request for the platform owner', () => {
    shell(['reply-parent-messages'], 'super admin');
    expect(api.listParentThreads).not.toHaveBeenCalled();
  });
});
