import { describe, expect, it } from 'vitest';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import {
  homeworkDaysUntil,
  homeworkDueLabel,
  homeworkErrorMessage,
  homeworkTodoCount,
  isAccessDenied,
  parseDateOnly,
  splitHomework,
  toDateOnly,
} from './homework';

const NOW = new Date(2026, 10, 5, 23, 59); // Thu 5 Nov, late evening
const h = (dueDate: string, isDone = false) => ({ dueDate, isDone });

describe('date handling', () => {
  it('reads a date-only string as a local calendar day', () => {
    const d = parseDateOnly('2026-11-05');
    expect([d?.getFullYear(), d?.getMonth(), d?.getDate()]).toEqual([2026, 10, 5]);
    expect(parseDateOnly('soon')).toBeNull();
  });
  it('formats a local day back', () => {
    expect(toDateOnly(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
  it('counts whole days regardless of the time of day', () => {
    expect(homeworkDaysUntil('2026-11-05', NOW)).toBe(0);
    expect(homeworkDaysUntil('2026-11-06', NOW)).toBe(1);
    expect(homeworkDaysUntil('2026-11-02', NOW)).toBe(-3);
    expect(homeworkDaysUntil('nonsense', NOW)).toBe(0);
  });
  it('labels due dates', () => {
    expect(homeworkDueLabel('2026-11-05', NOW)).toBe('Due today');
    expect(homeworkDueLabel('2026-11-06', NOW)).toBe('Due tomorrow');
    expect(homeworkDueLabel('2026-11-12', NOW)).toBe('Due in 7 days');
    expect(homeworkDueLabel('2026-11-04', NOW)).toBe('1 day overdue');
    expect(homeworkDueLabel('2026-10-30', NOW)).toBe('6 days overdue');
  });
});

describe('splitHomework', () => {
  it('separates to do, overdue and done, each in a sensible order', () => {
    const items = [h('2026-11-09'), h('2026-11-05'), h('2026-11-03'), h('2026-11-01'), h('2026-11-02', true), h('2026-11-08', true)];
    const g = splitHomework(items, NOW);
    expect(g.todo.map((i) => i.dueDate)).toEqual(['2026-11-05', '2026-11-09']);
    expect(g.overdue.map((i) => i.dueDate)).toEqual(['2026-11-01', '2026-11-03']);
    expect(g.done.map((i) => i.dueDate)).toEqual(['2026-11-08', '2026-11-02']);
  });
  it('handles an empty list', () => {
    expect(splitHomework([], NOW)).toEqual({ todo: [], overdue: [], done: [] });
  });
});

describe('homeworkTodoCount', () => {
  it('counts unticked items due today or later only', () => {
    expect(homeworkTodoCount([h('2026-11-05'), h('2026-11-09'), h('2026-11-04'), h('2026-11-09', true)], NOW)).toBe(2);
  });
  it('is zero while loading', () => {
    expect(homeworkTodoCount(null, NOW)).toBe(0);
  });
});

describe('error text', () => {
  it('shows the intended server messages and hides anything else', () => {
    expect(homeworkErrorMessage(new AnalyticsAPIError('SERVER_ERROR', 'Due date cannot be in the past'), 'x')).toBe('Due date cannot be in the past');
    expect(homeworkErrorMessage(new AnalyticsAPIError('ACCESS_DENIED', 'Access denied: not allocated to this class and subject'), 'x')).toBe(
      'Access denied: not allocated to this class and subject'
    );
    expect(homeworkErrorMessage(new AnalyticsAPIError('SERVER_ERROR', 'column "foo" does not exist'), 'Fallback')).toBe('Fallback');
    expect(homeworkErrorMessage(new AnalyticsAPIError('ACCESS_DENIED', 'Permission denied'), 'Fallback')).toBe('You do not have access to do that.');
    expect(homeworkErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
  it('shows the specific 42501 messages when the error comes through the real Supabase mapping', () => {
    const fromServer = (message: string) => AnalyticsAPIError.fromSupabaseError({ code: '42501', message });
    expect(homeworkErrorMessage(fromServer('Access denied: not allocated to this class and subject'), 'x')).toBe(
      'Access denied: not allocated to this class and subject'
    );
    expect(homeworkErrorMessage(fromServer('Access denied: you can only change homework you created'), 'x')).toBe(
      'Access denied: you can only change homework you created'
    );
    // Not on the list: generic text, and the server's wording is not shown.
    expect(homeworkErrorMessage(fromServer('Access denied: manage-homework permission required'), 'x')).toBe('You do not have access to do that.');
    expect(homeworkErrorMessage(fromServer('permission denied for table homework_items'), 'x')).toBe('You do not have access to do that.');
    // The generic message and the code are unchanged for every other consumer.
    const denied = fromServer('Access denied: not allocated to this class and subject');
    expect(denied.message).toBe('Permission denied');
    expect(denied.code).toBe('ACCESS_DENIED');
    expect(isAccessDenied(denied)).toBe(true);
  });
  it('recognises an access refusal', () => {
    expect(isAccessDenied(new AnalyticsAPIError('ACCESS_DENIED', 'Access denied'))).toBe(true);
    expect(isAccessDenied(new Error('Access denied'))).toBe(false);
  });
});
