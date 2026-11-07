import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const api = vi.hoisted(() => ({ listParentThreads: vi.fn() }));
vi.mock('@/lib/analytics/api', () => ({ ...api, isAbortError: () => false }));

import { STAFF_UNREAD_POLL_MS, useStaffUnreadMessages } from './useStaffUnreadMessages';

const thread = (id: string, isUnread: boolean) => ({ threadId: id, isUnread });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  api.listParentThreads.mockResolvedValue([thread('1', true), thread('2', false), thread('3', true)]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useStaffUnreadMessages', () => {
  it('counts only unread threads', async () => {
    const { result } = renderHook(() => useStaffUnreadMessages(true, '/analytics'));
    await act(async () => {});
    expect(result.current).toBe(2);
  });

  it('makes no request and reports 0 when disabled', async () => {
    const { result } = renderHook(() => useStaffUnreadMessages(false, '/analytics'));
    await act(async () => {});
    expect(api.listParentThreads).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });

  it('reloads when the page changes and on the poll interval', async () => {
    const { result, rerender } = renderHook(({ key }) => useStaffUnreadMessages(true, key), {
      initialProps: { key: '/analytics/parent-messages' },
    });
    await act(async () => {});
    expect(api.listParentThreads).toHaveBeenCalledTimes(1);

    api.listParentThreads.mockResolvedValue([thread('1', false), thread('2', false), thread('3', true)]);
    rerender({ key: '/analytics' });
    await act(async () => {});
    expect(api.listParentThreads).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(1);

    api.listParentThreads.mockResolvedValue([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAFF_UNREAD_POLL_MS);
    });
    expect(api.listParentThreads).toHaveBeenCalledTimes(3);
    expect(result.current).toBe(0);
  });

  it('keeps the last count when a reload fails', async () => {
    const { result } = renderHook(() => useStaffUnreadMessages(true, '/analytics'));
    await act(async () => {});
    expect(result.current).toBe(2);
    api.listParentThreads.mockRejectedValue(new Error('offline'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAFF_UNREAD_POLL_MS);
    });
    expect(result.current).toBe(2);
  });

  it('stops polling on unmount', async () => {
    const { unmount } = renderHook(() => useStaffUnreadMessages(true, '/analytics'));
    await act(async () => {});
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAFF_UNREAD_POLL_MS * 3);
    });
    expect(api.listParentThreads).toHaveBeenCalledTimes(1);
  });
});
